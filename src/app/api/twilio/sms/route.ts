import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { sendWheelPackageEmail } from '@/lib/email-package'
import { getSmsDemoCardsByIds, handleSmsDemoMessage, type SmsDemoState } from '@/lib/sms-demo'

type SmsSessionRow = {
  phone: string
  state_json: string | null
  opted_out: number | null
}

function ensureSmsSessionsTable() {
  const db = getDb()
  db.prepare(`
    CREATE TABLE IF NOT EXISTS sms_sessions (
      phone TEXT PRIMARY KEY,
      state_json TEXT,
      opted_out INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run()
}

function loadSession(phone: string): { state: SmsDemoState; optedOut: boolean } {
  ensureSmsSessionsTable()
  const db = getDb()
  const row = db.prepare('SELECT phone, state_json, opted_out FROM sms_sessions WHERE phone = ?').get(phone) as SmsSessionRow | undefined
  if (!row) return { state: {}, optedOut: false }

  try {
    return {
      state: row.state_json ? JSON.parse(row.state_json) as SmsDemoState : {},
      optedOut: row.opted_out === 1,
    }
  } catch {
    return { state: {}, optedOut: row.opted_out === 1 }
  }
}

function saveSession(phone: string, state: SmsDemoState, optedOut = false) {
  ensureSmsSessionsTable()
  const db = getDb()
  db.prepare(`
    INSERT INTO sms_sessions (phone, state_json, opted_out, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(phone) DO UPDATE SET
      state_json = excluded.state_json,
      opted_out = excluded.opted_out,
      updated_at = CURRENT_TIMESTAMP
  `).run(phone, JSON.stringify(state), optedOut ? 1 : 0)
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function twiml(message: string, status = 200) {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${xmlEscape(message)}</Message></Response>`, {
    status,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  })
}

function appBaseUrl(request: NextRequest) {
  const configured = process.env.TWILIO_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL
  if (configured) return configured.replace(/\/$/, '')

  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
  if (forwardedHost && !forwardedHost.includes('localhost')) {
    return `${forwardedProto}://${forwardedHost}`
  }

  const host = request.headers.get('host')
  if (host && !host.includes('localhost')) {
    return `https://${host}`
  }

  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

function validateTwilioSignature(requestUrl: string, params: Record<string, string>, signature: string, authToken: string) {
  const payload = Object.keys(params)
    .sort()
    .reduce((acc, key) => `${acc}${key}${params[key]}`, requestUrl)
  const digest = crypto.createHmac('sha1', authToken).update(payload).digest('base64')

  const expected = Buffer.from(digest)
  const actual = Buffer.from(signature)
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const params = Object.fromEntries(
      [...form.entries()]
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    )

    const shouldValidate = process.env.TWILIO_VALIDATE_SIGNATURE === 'true'
    const authToken = process.env.TWILIO_AUTH_TOKEN || ''
    const signature = request.headers.get('x-twilio-signature') || ''

    if (shouldValidate) {
      if (!authToken) {
        console.warn('[config] TWILIO_VALIDATE_SIGNATURE=true but TWILIO_AUTH_TOKEN is missing')
        return twiml('SMS assistant is missing Twilio webhook verification config.', 500)
      }
      if (!signature || !validateTwilioSignature(request.url, params, signature, authToken)) {
        return twiml('Invalid Twilio signature.', 403)
      }
    }

    const from = params.From || 'unknown'
    const body = (params.Body || '').trim()

    if (!body) return twiml('Text me a vehicle and wheel request, like: 22 inch TIS wheels for a 2022 Ford F-150')

    const normalized = body.toLowerCase()
    if (/^\s*(stop|stopall|unsubscribe|cancel|end|quit)\s*$/i.test(body)) {
      saveSession(from, {}, true)
      return twiml('You are opted out of the TIS SMS Assistant demo. Reply START to resume.')
    }

    if (/^\s*(start|unstop|yes)\s*$/i.test(body)) {
      saveSession(from, {}, false)
      return twiml('TIS SMS Assistant demo is back on. Ask me for wheels by vehicle, size, finish, or brand.')
    }

    if (/^\s*help\s*$/i.test(body)) {
      return twiml('Ask like: What 22" TIS wheels are stock for a 2022 Ford F-150? I will drill down, return stocked options, and collect an email for ATD links.')
    }

    const session = loadSession(from)
    if (session.optedOut && normalized !== 'start') {
      return twiml('You are opted out. Reply START to resume.')
    }

    const reply = handleSmsDemoMessage(body, session.state, { baseUrl: appBaseUrl(request) })
    saveSession(from, reply.state, false)

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
        : [`I captured ${reply.emailPreview.to}, but email delivery is not configured yet. Full cards: ${reply.resultUrl || appBaseUrl(request)}`]
    }

    const resultLink = reply.resultUrl && reply.cards?.length ? `\n\nFull cards: ${reply.resultUrl}` : ''
    return twiml(`${reply.messages.join('\n\n')}${resultLink}`)
  } catch (error) {
    console.error('Twilio SMS webhook error:', error)
    return twiml('Sorry — the TIS SMS Assistant hit an error. Try again in a minute.', 500)
  }
}
