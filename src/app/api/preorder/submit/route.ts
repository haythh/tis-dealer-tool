import { NextResponse } from 'next/server'

const RECIPIENT_EMAIL = 'hh@tiswheels.com'
const VALID_CATEGORIES = ['TIS MOTORSPORTS FORGED', 'TIS OFFROAD FORGED'] as const
const DEFAULT_CATEGORY = 'TIS MOTORSPORTS FORGED'
const SUCCESS_MESSAGE = 'Thank You! Your order has been submitted and an ATD representative will contact you soon.'

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type RetailerDetails = {
  name: string
  companyName: string
  address: string
  phone: string
  email: string
}

type PreorderItem = {
  wheelName: string
  category: (typeof VALID_CATEGORIES)[number]
  image: string
  size: string
  width: string
  lugPattern: string
  quantity: number
  unitPrice: number
  total: number
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function dollars(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isValidImagePath(value: string) {
  return (value.startsWith('/preorder-wheels/') || value.startsWith('/preorder-offroad-wheels/')) && !value.includes('..')
}

function cleanCategory(value: unknown) {
  const category = cleanString(value)
  return VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number]) ? category as (typeof VALID_CATEGORIES)[number] : DEFAULT_CATEGORY
}

function absoluteImageUrl(image: string, origin: string) {
  if (!isValidImagePath(image)) return ''
  return new URL(image, origin).toString()
}

function validatePayload(body: unknown): { retailer: RetailerDetails; items: PreorderItem[]; grandTotal: number } | { error: string; status: number } {
  if (!body || typeof body !== 'object') return { error: 'Invalid preorder payload.', status: 400 }

  const payload = body as { retailer?: Record<string, unknown>; items?: unknown[] }
  const retailer = {
    name: cleanString(payload.retailer?.name),
    companyName: cleanString(payload.retailer?.companyName),
    address: cleanString(payload.retailer?.address),
    phone: cleanString(payload.retailer?.phone),
    email: cleanString(payload.retailer?.email),
  }

  if (!retailer.name || !retailer.companyName || !retailer.address || !retailer.phone || !retailer.email) {
    return { error: 'Name, company name, address, phone, and email are required.', status: 400 }
  }

  if (!VALID_EMAIL.test(retailer.email)) {
    return { error: 'A valid retailer email is required.', status: 400 }
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    return { error: 'At least one preorder item is required.', status: 400 }
  }

  if (payload.items.length > 100) {
    return { error: 'Too many preorder items submitted at once.', status: 400 }
  }

  const items: PreorderItem[] = []
  for (const rawItem of payload.items) {
    if (!rawItem || typeof rawItem !== 'object') return { error: 'Every preorder item must be an object.', status: 400 }
    const item = rawItem as Record<string, unknown>
    const quantity = Number(item.quantity)
    const unitPrice = Number(item.unitPrice)
    const total = Number(item.total)
    const cleaned = {
      wheelName: cleanString(item.wheelName),
      category: cleanCategory(item.category),
      image: cleanString(item.image),
      size: cleanString(item.size),
      width: cleanString(item.width),
      lugPattern: cleanString(item.lugPattern),
      quantity,
      unitPrice,
      total,
    }

    if (!cleaned.wheelName || !cleaned.size || !cleaned.width || !cleaned.lugPattern || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(total) || total < 0) {
      return { error: 'Each preorder item must include wheel code, size, width, lug pattern, quantity, unit price, and line total.', status: 400 }
    }

    const computedTotal = quantity * unitPrice
    if (Math.abs(computedTotal - total) > 0.01) {
      return { error: 'Each preorder item line total must match quantity times unit price.', status: 400 }
    }

    items.push(cleaned)
  }

  return { retailer, items, grandTotal: items.reduce((sum, item) => sum + item.total, 0) }
}

function textBody(retailer: RetailerDetails, items: PreorderItem[], grandTotal: number) {
  return [
    'New TIS preorder submission',
    '',
    `Name: ${retailer.name}`,
    `Company: ${retailer.companyName}`,
    `Address: ${retailer.address}`,
    `Phone: ${retailer.phone}`,
    `Email: ${retailer.email}`,
    '',
    'Items:',
    ...items.map(item => `${item.wheelName} — ${item.category} — ${item.size} x ${item.width} — ${item.lugPattern} — Qty ${item.quantity} — ${dollars(item.unitPrice)} ea — ${dollars(item.total)}`),
    '',
    `Grand total: ${dollars(grandTotal)}`,
  ].join('\n')
}

function htmlBody(retailer: RetailerDetails, items: PreorderItem[], grandTotal: number, origin: string) {
  const rows = items.map(item => {
    const imageUrl = absoluteImageUrl(item.image, origin)
    return `
      <tr>
        <td style="padding:14px;border-bottom:1px solid #e5e7eb;vertical-align:middle;">
          ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.wheelName)}" width="72" style="display:block;width:72px;height:72px;object-fit:contain;background:#f4f4f5;border-radius:12px;" />` : ''}
        </td>
        <td style="padding:14px;border-bottom:1px solid #e5e7eb;vertical-align:middle;">
          <div style="font-size:18px;font-weight:900;color:#111827;">${escapeHtml(item.wheelName)}</div>
          <div style="margin-top:3px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#991b1b;font-weight:900;">${escapeHtml(item.category)}</div>
        </td>
        <td style="padding:14px;border-bottom:1px solid #e5e7eb;vertical-align:middle;color:#374151;">${escapeHtml(item.size)}</td>
        <td style="padding:14px;border-bottom:1px solid #e5e7eb;vertical-align:middle;color:#374151;">${escapeHtml(item.width)}</td>
        <td style="padding:14px;border-bottom:1px solid #e5e7eb;vertical-align:middle;color:#374151;">${escapeHtml(item.lugPattern)}</td>
        <td style="padding:14px;border-bottom:1px solid #e5e7eb;vertical-align:middle;color:#374151;text-align:center;">${escapeHtml(item.quantity)}</td>
        <td style="padding:14px;border-bottom:1px solid #e5e7eb;vertical-align:middle;color:#374151;text-align:right;">${escapeHtml(dollars(item.unitPrice))}</td>
        <td style="padding:14px;border-bottom:1px solid #e5e7eb;vertical-align:middle;color:#111827;font-weight:800;text-align:right;">${escapeHtml(dollars(item.total))}</td>
      </tr>
    `
  }).join('')

  return `<!doctype html>
    <html>
      <body style="margin:0;background:#f3f4f6;padding:24px;font-family:Arial,sans-serif;color:#111827;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:920px;margin:0 auto;border-collapse:collapse;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 24px 70px rgba(15,23,42,.12);">
          <tr>
            <td style="padding:30px 34px;background:#050506;color:#ffffff;">
              <div style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#fca5a5;font-weight:900;">TIS Dealer Preorder</div>
              <h1 style="margin:10px 0 0;font-size:32px;line-height:1.1;">New retailer preorder submission</h1>
              <p style="margin:10px 0 0;color:#d1d5db;font-size:15px;line-height:1.6;">${escapeHtml(retailer.companyName)} submitted a preorder request.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 34px 8px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f9fafb;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;">
                <tr><td style="padding:18px 20px;font-size:20px;font-weight:900;color:#111827;" colspan="2">Retailer details</td></tr>
                <tr><td style="padding:0 20px 8px;color:#6b7280;font-weight:800;">Name</td><td style="padding:0 20px 8px;text-align:right;">${escapeHtml(retailer.name)}</td></tr>
                <tr><td style="padding:0 20px 8px;color:#6b7280;font-weight:800;">Company</td><td style="padding:0 20px 8px;text-align:right;">${escapeHtml(retailer.companyName)}</td></tr>
                <tr><td style="padding:0 20px 8px;color:#6b7280;font-weight:800;">Phone</td><td style="padding:0 20px 8px;text-align:right;">${escapeHtml(retailer.phone)}</td></tr>
                <tr><td style="padding:0 20px 8px;color:#6b7280;font-weight:800;">Email</td><td style="padding:0 20px 8px;text-align:right;"><a href="mailto:${escapeHtml(retailer.email)}" style="color:#dc2626;">${escapeHtml(retailer.email)}</a></td></tr>
                <tr><td style="padding:0 20px 18px;color:#6b7280;font-weight:800;vertical-align:top;">Address</td><td style="padding:0 20px 18px;text-align:right;white-space:pre-line;">${escapeHtml(retailer.address)}</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 34px 34px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                <thead>
                  <tr style="background:#f9fafb;">
                    <th style="padding:12px 14px;text-align:left;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;">Image</th>
                    <th style="padding:12px 14px;text-align:left;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;">Code</th>
                    <th style="padding:12px 14px;text-align:left;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;">Size</th>
                    <th style="padding:12px 14px;text-align:left;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;">Width</th>
                    <th style="padding:12px 14px;text-align:left;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;">Lug</th>
                    <th style="padding:12px 14px;text-align:center;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;">Qty</th>
                    <th style="padding:12px 14px;text-align:right;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;">Unit</th>
                    <th style="padding:12px 14px;text-align:right;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;">Line</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
              <div style="margin-top:24px;text-align:right;font-size:28px;font-weight:900;color:#111827;">Grand total: ${escapeHtml(dollars(grandTotal))}</div>
            </td>
          </tr>
        </table>
      </body>
    </html>`
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const validated = validatePayload(body)
  if ('error' in validated) {
    return NextResponse.json({ error: validated.error }, { status: validated.status })
  }

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!apiKey) {
    console.warn('[config] RESEND_API_KEY not set — preorder checkout email cannot be sent.')
    return NextResponse.json({ error: 'RESEND_API_KEY is not configured. Preorder checkout email cannot be sent.' }, { status: 500 })
  }

  if (!from) {
    console.warn('[config] EMAIL_FROM not set — preorder checkout email cannot be sent.')
    return NextResponse.json({ error: 'EMAIL_FROM is not configured. Preorder checkout email cannot be sent.' }, { status: 500 })
  }

  const bcc = process.env.EMAIL_BCC?.split(',').map(value => value.trim()).filter(Boolean)
  const replyTo = process.env.EMAIL_REPLY_TO || validated.retailer.email
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [RECIPIENT_EMAIL],
      ...(bcc?.length ? { bcc } : {}),
      reply_to: replyTo,
      subject: `TIS preorder from ${validated.retailer.companyName}`,
      html: htmlBody(validated.retailer, validated.items, validated.grandTotal, origin),
      text: textBody(validated.retailer, validated.items, validated.grandTotal),
    }),
  })

  const data = await response.json().catch(() => ({})) as { id?: string; message?: string; error?: string }

  if (!response.ok) {
    console.error('Resend preorder email failed:', data)
    return NextResponse.json({ error: data.message || data.error || `Resend returned HTTP ${response.status}` }, { status: 502 })
  }

  return NextResponse.json({ message: SUCCESS_MESSAGE, id: data.id })
}
