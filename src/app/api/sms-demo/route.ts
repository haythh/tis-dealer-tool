import { NextRequest, NextResponse } from 'next/server'
import { getSmsDemoCardsByIds, handleSmsDemoMessage, type SmsDemoState } from '@/lib/sms-demo'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ids = (searchParams.get('ids') || searchParams.get('results') || '')
      .split(',')
      .map(value => parseInt(value, 10))
      .filter(Number.isFinite)

    return NextResponse.json({ cards: getSmsDemoCardsByIds(ids) })
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

    return NextResponse.json(handleSmsDemoMessage(message, state))
  } catch (error) {
    console.error('SMS demo error:', error)
    return NextResponse.json({ error: 'SMS demo failed' }, { status: 500 })
  }
}
