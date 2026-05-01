import { NextRequest, NextResponse } from 'next/server'
import { handleSmsDemoMessage, type SmsDemoState } from '@/lib/sms-demo'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const message = typeof body.message === 'string' ? body.message : ''
    const state = (body.state || {}) as SmsDemoState

    if (!message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    return NextResponse.json(handleSmsDemoMessage(message, state))
  } catch (error) {
    console.error('SMS demo error:', error)
    return NextResponse.json({ error: 'SMS demo failed' }, { status: 500 })
  }
}
