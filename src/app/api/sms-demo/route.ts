import { NextRequest, NextResponse } from 'next/server'
import { getSmsDemoCardsByIds, getSmsDemoCardsByResultToken, handleSmsDemoMessage, type SmsDemoState } from '@/lib/sms-demo'
import { sendWheelPackageEmail } from '@/lib/email-package'

function appBaseUrl(request: NextRequest) {
  const configured = process.env.TWILIO_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL
  if (configured) return configured.replace(/\/$/, '')
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ids = (searchParams.get('ids') || searchParams.get('results') || '')
      .split(',')
      .map(value => parseInt(value, 10))
      .filter(Number.isFinite)
    const token = searchParams.get('token') || ''

    return NextResponse.json({ cards: token ? getSmsDemoCardsByResultToken(token) : getSmsDemoCardsByIds(ids) })
  } catch (error) {
    console.error('SMS demo results error:', error)
    return NextResponse.json({ error: 'Failed to load SMS demo results' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const message = typeof body.message === 'string' ? body.message : ''
    const state = (body.state || {}) as SmsDemoState

    if (!message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const reply = handleSmsDemoMessage(message, state, { baseUrl: appBaseUrl(request) })

    if (reply.emailPreview) {
      const cards = getSmsDemoCardsByIds(reply.state.lastResultIds || [])
      const emailResult = await sendWheelPackageEmail({
        to: reply.emailPreview.to,
        cards,
        state: reply.state,
        resultUrl: reply.resultUrl,
      })

      reply.messages = emailResult.sent
        ? [`Sent wheel-card package to ${reply.emailPreview.to}: specs, stock, pricing, and ATD buy links.`]
        : [`I captured ${reply.emailPreview.to}, but email delivery is not configured yet. The wheel-card package is ready here: ${reply.resultUrl || 'open the generated cards below'}`]

      return NextResponse.json({ ...reply, emailDelivery: emailResult })
    }

    return NextResponse.json(reply)
  } catch (error) {
    console.error('SMS demo error:', error)
    return NextResponse.json({ error: 'SMS demo failed' }, { status: 500 })
  }
}
