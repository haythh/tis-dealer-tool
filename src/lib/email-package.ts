import type { SmsDemoCard, SmsDemoState } from '@/lib/sms-demo'

export type EmailPackageResult = {
  sent: boolean
  skipped?: boolean
  provider?: 'resend'
  id?: string
  reason?: string
}

type SendWheelPackageInput = {
  to: string
  cards: SmsDemoCard[]
  state?: SmsDemoState
  resultUrl?: string
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function currency(value: number | null) {
  return value ? `$${Math.round(value).toLocaleString()}` : 'TBD'
}

function vehicleLabel(state?: SmsDemoState) {
  const vehicle = state?.vehicle
  if (!vehicle) return 'your vehicle'
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'your vehicle'
}

function textSummary(cards: SmsDemoCard[], resultUrl?: string) {
  const lines = cards.map((card, index) => {
    const stock = typeof card.total_stock === 'number' ? `${card.total_stock} available` : 'stock shown in ATD'
    return `${index + 1}. ${card.brand} ${card.model} ${card.size} — ${card.color_finish} — ${currency(card.map_price)} — ${stock}${card.atd_url ? ` — ${card.atd_url}` : ''}`
  })

  return [
    'TIS wheel options',
    '',
    ...lines,
    '',
    resultUrl ? `View full cards: ${resultUrl}` : '',
    'Reply to your TIS or ATD representative with questions.',
  ].filter(Boolean).join('\n')
}

function cardHtml(card: SmsDemoCard) {
  const imageUrl = card.ta_image_url || card.atd_image_url
  return `
    <tr>
      <td style="padding:18px 0;border-bottom:1px solid #e5e7eb;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tr>
            <td width="150" valign="top" style="padding-right:18px;">
              ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" width="140" alt="${escapeHtml(`${card.brand} ${card.model}`)}" style="display:block;width:140px;max-width:140px;border-radius:14px;background:#111827;" />` : `<div style="width:140px;height:105px;border-radius:14px;background:#111827;color:#fff;text-align:center;line-height:105px;font-weight:700;">TIS</div>`}
            </td>
            <td valign="top" style="font-family:Arial,sans-serif;">
              <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#dc2626;font-weight:700;">${escapeHtml(card.brand)}</div>
              <div style="margin-top:4px;font-size:24px;line-height:1.1;font-weight:800;color:#111827;">${escapeHtml(card.model)}</div>
              <div style="margin-top:4px;font-size:14px;color:#4b5563;">${escapeHtml(card.color_finish)}</div>
              <div style="margin-top:12px;font-size:14px;line-height:1.7;color:#111827;">
                <strong>Size:</strong> ${escapeHtml(card.size)} &nbsp; <strong>Offset:</strong> ${escapeHtml(card.offset_mm || '—')}<br />
                <strong>Bolt:</strong> ${escapeHtml(card.bolt_pattern)} &nbsp; <strong>Hub:</strong> ${escapeHtml(card.hub_bore || '—')}<br />
                <strong>MAP:</strong> ${escapeHtml(currency(card.map_price))} &nbsp; <strong>Stock:</strong> ${escapeHtml(card.total_stock ?? 0)} total / ${escapeHtml(card.stock_today ?? 0)} today / ${escapeHtml(card.stock_national ?? 0)} national
              </div>
              ${card.atd_url ? `<a href="${escapeHtml(card.atd_url)}" style="display:inline-block;margin-top:14px;padding:10px 14px;border-radius:999px;background:#dc2626;color:#ffffff;text-decoration:none;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">Open ATD Link</a>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `
}

function htmlBody(input: SendWheelPackageInput) {
  const label = vehicleLabel(input.state)
  const cards = input.cards.map(cardHtml).join('')

  return `
    <!doctype html>
    <html>
      <body style="margin:0;background:#f3f4f6;padding:24px;font-family:Arial,sans-serif;color:#111827;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:760px;margin:0 auto;border-collapse:collapse;background:#ffffff;border-radius:24px;overflow:hidden;">
          <tr>
            <td style="padding:28px 30px;background:#050506;color:#ffffff;">
              <div style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#fca5a5;font-weight:800;">TIS Dealer Tool</div>
              <h1 style="margin:10px 0 0;font-size:30px;line-height:1.1;">Wheel options for ${escapeHtml(label)}</h1>
              <p style="margin:10px 0 0;color:#d1d5db;font-size:15px;line-height:1.6;">Specs, stock, pricing, and ATD product links from the TIS SMS Assistant.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 30px 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                ${cards || '<tr><td style="padding:24px 0;font-family:Arial,sans-serif;color:#4b5563;">No wheel cards were selected.</td></tr>'}
              </table>
            </td>
          </tr>
          ${input.resultUrl ? `<tr><td style="padding:24px 30px;"><a href="${escapeHtml(input.resultUrl)}" style="display:block;text-align:center;padding:15px 18px;border-radius:16px;background:#111827;color:#ffffff;text-decoration:none;font-weight:800;">View full wheel-card package</a></td></tr>` : ''}
          <tr>
            <td style="padding:0 30px 30px;color:#6b7280;font-size:12px;line-height:1.6;">
              Final fitment, availability, and pricing should be confirmed in ATDOnline before purchase.
            </td>
          </tr>
        </table>
      </body>
    </html>
  `
}

export async function sendWheelPackageEmail(input: SendWheelPackageInput): Promise<EmailPackageResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!apiKey) {
    console.warn('[config] RESEND_API_KEY not set — wheel package email skipped.')
    return { sent: false, skipped: true, reason: 'RESEND_API_KEY is not configured' }
  }

  if (!from) {
    console.warn('[config] EMAIL_FROM not set — wheel package email skipped.')
    return { sent: false, skipped: true, reason: 'EMAIL_FROM is not configured' }
  }

  const bcc = process.env.EMAIL_BCC?.split(',').map(value => value.trim()).filter(Boolean)
  const replyTo = process.env.EMAIL_REPLY_TO || undefined
  const subject = `TIS wheel options for ${vehicleLabel(input.state)}`

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      ...(bcc?.length ? { bcc } : {}),
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject,
      html: htmlBody(input),
      text: textSummary(input.cards, input.resultUrl),
    }),
  })

  const data = await response.json().catch(() => ({})) as { id?: string; message?: string; error?: string }

  if (!response.ok) {
    console.error('Resend email failed:', data)
    return {
      sent: false,
      provider: 'resend',
      reason: data.message || data.error || `Resend returned HTTP ${response.status}`,
    }
  }

  return { sent: true, provider: 'resend', id: data.id }
}
