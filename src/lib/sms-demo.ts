import { getDb, normalizeBoltPattern, type Wheel } from '@/lib/db'

export type SmsDemoVehicle = {
  year: number | null
  make: string | null
  model: string | null
}

export type SmsDemoState = {
  vehicle?: SmsDemoVehicle | null
  size?: string | null
  finish?: string | null
  brand?: string | null
  awaiting?: 'vehicle' | 'size' | 'finish' | 'email' | null
  finishPreferenceAsked?: boolean
  lastResultIds?: number[]
  email?: string | null
}

export type SmsDemoCard = Pick<Wheel,
  | 'id'
  | 'supplier_pn'
  | 'brand'
  | 'model'
  | 'color_finish'
  | 'size'
  | 'offset_mm'
  | 'bolt_pattern'
  | 'hub_bore'
  | 'map_price'
  | 'atd_url'
  | 'in_stock'
  | 'stock_today'
  | 'stock_tomorrow'
  | 'stock_national'
  | 'total_stock'
  | 'ta_image_url'
  | 'atd_image_url'
>

export type SmsDemoReply = {
  state: SmsDemoState
  messages: string[]
  cards?: SmsDemoCard[]
  resultUrl?: string
  emailPreview?: {
    to: string
    subject: string
    wheelCount: number
  }
}

type ParsedSms = {
  vehicle?: SmsDemoVehicle | null
  size?: string | null
  finish?: string | null
  brand?: string | null
  wantsEmail?: boolean
  email?: string | null
}

const WHEEL_FIELDS = 'id, supplier_pn, brand, model, color_finish, size, offset_mm, bolt_pattern, hub_bore, map_price, atd_url, in_stock, stock_today, stock_tomorrow, stock_national, total_stock, ta_image_url, atd_image_url'

const FINISH_TERMS: Record<string, string> = {
  chrome: 'Chrome',
  black: 'Black',
  'gloss black': 'Gloss Black',
  'matte black': 'Matte Black',
  'satin black': 'Satin Black',
  machined: 'Machined',
  bronze: 'Bronze',
  gunmetal: 'Gunmetal',
  silver: 'Silver',
}

function compact(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function extractVehicle(q: string): SmsDemoVehicle | null {
  const lower = q.toLowerCase()
  const yearMatch = lower.match(/\b(19|20)\d{2}\b/)
  const year = yearMatch ? parseInt(yearMatch[0], 10) : null

  const modelMap: Array<[RegExp, string, string]> = [
    [/\bf[-\s]?150\b|\bf150\b/, 'Ford', 'F-150'],
    [/\bf[-\s]?250\b|\bf250\b/, 'Ford', 'F-250'],
    [/\bf[-\s]?350\b|\bf350\b/, 'Ford', 'F-350'],
    [/\bbronco\b/, 'Ford', 'Bronco'],
    [/\branger\b/, 'Ford', 'Ranger'],
    [/\bsilverado\b/, 'Chevrolet', 'Silverado'],
    [/\bsierra\b/, 'GMC', 'Sierra'],
    [/\btacoma\b/, 'Toyota', 'Tacoma'],
    [/\btundra\b/, 'Toyota', 'Tundra'],
    [/\b4runner\b/, 'Toyota', '4Runner'],
    [/\bwrangler\b/, 'Jeep', 'Wrangler'],
    [/\bgladiator\b/, 'Jeep', 'Gladiator'],
    [/\bram\s?(1500|2500|3500)?\b/, 'RAM', '1500'],
  ]

  for (const [pattern, make, defaultModel] of modelMap) {
    const match = lower.match(pattern)
    if (match) {
      return {
        year,
        make,
        model: make === 'RAM' && match[1] ? match[1] : defaultModel,
      }
    }
  }

  const makeOnly = lower.match(/\b(ford|chevy|chevrolet|gmc|ram|toyota|jeep)\b/)
  if (makeOnly) {
    const make = makeOnly[1] === 'chevy' ? 'Chevrolet' : makeOnly[1].charAt(0).toUpperCase() + makeOnly[1].slice(1)
    return { year, make, model: null }
  }

  return year ? { year, make: null, model: null } : null
}

export function parseSmsText(text: string): ParsedSms {
  const q = text.trim()
  const lower = q.toLowerCase()
  const email = q.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null

  const size = lower.match(/\b(17|18|20|22|24|26|28|30)\s*(?:in|inch|inches|\")?\b/)?.[1] || null

  let finish: string | null = null
  const finishEntries = Object.entries(FINISH_TERMS).sort((a, b) => b[0].length - a[0].length)
  for (const [term, value] of finishEntries) {
    if (lower.includes(term)) {
      finish = value
      break
    }
  }

  let brand: string | null = null
  if (/\bdts\b|dropstars/.test(lower)) brand = 'DTS'
  else if (/motorsports/.test(lower)) brand = 'TIS Motorsports'
  else if (/\btis\b/.test(lower)) brand = 'TIS'

  return {
    vehicle: extractVehicle(q),
    size,
    finish,
    brand,
    wantsEmail: /\b(email|send|quote|share)\b/.test(lower),
    email,
  }
}

function mergeState(state: SmsDemoState, parsed: ParsedSms, rawText: string): SmsDemoState {
  const lower = rawText.toLowerCase()
  const next: SmsDemoState = { ...state }

  if (parsed.vehicle) {
    next.vehicle = {
      year: parsed.vehicle.year ?? next.vehicle?.year ?? null,
      make: parsed.vehicle.make ?? next.vehicle?.make ?? null,
      model: parsed.vehicle.model ?? next.vehicle?.model ?? null,
    }
  }
  if (parsed.size) next.size = parsed.size
  if (parsed.finish) next.finish = parsed.finish
  if (parsed.brand) next.brand = parsed.brand
  if (parsed.email) next.email = parsed.email

  if (next.awaiting === 'finish' && /\b(all|any|show all|no preference|no pref|whatever)\b/.test(lower)) {
    next.finish = null
    next.finishPreferenceAsked = true
  }

  if (parsed.finish) next.finishPreferenceAsked = true

  return next
}

function describeVehicle(vehicle?: SmsDemoVehicle | null) {
  if (!vehicle) return ''
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')
}

function findBoltPatterns(vehicle: SmsDemoVehicle) {
  if (!vehicle.make && !vehicle.model) return []
  const db = getDb()
  let query = 'SELECT DISTINCT bolt_pattern FROM vehicles WHERE 1=1'
  const params: (string | number)[] = []

  if (vehicle.make) {
    query += ' AND LOWER(make) = LOWER(?)'
    params.push(vehicle.make)
  }
  if (vehicle.model) {
    query += ' AND LOWER(model) LIKE LOWER(?)'
    params.push(`%${vehicle.model}%`)
  }
  if (vehicle.year) {
    query += ' AND year_start <= ? AND year_end >= ?'
    params.push(vehicle.year, vehicle.year)
  }

  const rows = db.prepare(query).all(...params) as { bolt_pattern: string }[]
  return [...new Set(rows.flatMap(row => normalizeBoltPattern(row.bolt_pattern)))]
}

function searchCards(state: SmsDemoState): SmsDemoCard[] {
  const db = getDb()
  const conditions = ['in_stock = 1']
  const params: (string | number)[] = []

  const boltPatterns = state.vehicle ? findBoltPatterns(state.vehicle) : []
  if (boltPatterns.length) {
    conditions.push(`(${boltPatterns.map(pattern => `UPPER(bolt_pattern) LIKE UPPER(?)`).join(' OR ')})`)
    params.push(...boltPatterns.map(pattern => `%${pattern}%`))
  }

  if (state.size) {
    conditions.push('size LIKE ?')
    params.push(`${state.size}X%`)
  }

  if (state.finish) {
    conditions.push('LOWER(color_finish) LIKE LOWER(?)')
    params.push(`%${state.finish}%`)
  }

  if (state.brand) {
    conditions.push('UPPER(brand) = UPPER(?)')
    params.push(state.brand)
  }

  const where = conditions.join(' AND ')
  let cards = db.prepare(`
    SELECT ${WHEEL_FIELDS}
    FROM wheels
    WHERE ${where}
    ORDER BY COALESCE(total_stock, 0) DESC, map_price ASC
    LIMIT 6
  `).all(...params) as SmsDemoCard[]

  if (!cards.length && state.finish) {
    const relaxed = { ...state, finish: null }
    cards = searchCards(relaxed)
  }

  if (!cards.length) {
    cards = db.prepare(`
      SELECT ${WHEEL_FIELDS}
      FROM wheels
      WHERE in_stock = 1 AND ta_image_url IS NOT NULL
      ORDER BY COALESCE(total_stock, 0) DESC, map_price ASC
      LIMIT 6
    `).all() as SmsDemoCard[]
  }

  return cards
}

function resultUrlFor(cards: SmsDemoCard[]) {
  const ids = cards.map(card => card.id).join(',')
  return `/sms-demo?results=${encodeURIComponent(ids)}`
}

function summarizeCards(cards: SmsDemoCard[]) {
  return cards.slice(0, 3).map((card, index) => {
    const price = card.map_price ? `$${Math.round(card.map_price)}` : 'price TBD'
    const stock = typeof card.total_stock === 'number' ? `${card.total_stock} available` : 'stock shown in ATD'
    return `${index + 1}) ${card.brand} ${card.model} ${card.size} — ${card.color_finish}, ${price}, ${stock}`
  }).join('\n')
}

export function handleSmsDemoMessage(text: string, incomingState: SmsDemoState = {}): SmsDemoReply {
  const parsed = parseSmsText(text)
  const state = mergeState(incomingState, parsed, text)
  const lower = text.toLowerCase()

  if ((parsed.wantsEmail || state.awaiting === 'email') && !parsed.email) {
    return {
      state: { ...state, awaiting: 'email' },
      messages: ['Perfect — what email should I send the wheel cards and ATD buy links to?'],
    }
  }

  if (parsed.email) {
    const count = state.lastResultIds?.length || 0
    return {
      state: { ...state, awaiting: null, email: parsed.email },
      messages: [`Sent demo package to ${parsed.email}: wheel cards, specs, stock, pricing, and ATD buy links. In production this becomes the actual branded quote email.`],
      emailPreview: {
        to: parsed.email,
        subject: `TIS wheel options${state.vehicle ? ` for ${describeVehicle(state.vehicle)}` : ''}`,
        wheelCount: count,
      },
    }
  }

  if (!state.vehicle?.year || !state.vehicle?.make || !state.vehicle?.model) {
    return {
      state: { ...state, awaiting: 'vehicle' },
      messages: ['Got it. What vehicle year, make, and model? Example: 2022 Ford F-150.'],
    }
  }

  if (!state.size) {
    return {
      state: { ...state, awaiting: 'size' },
      messages: [`Nice. What wheel diameter for the ${describeVehicle(state.vehicle)} — 20, 22, 24, or show me all?`],
    }
  }

  if (!state.finishPreferenceAsked && !state.finish && !/\b(all|any|show all)\b/.test(lower)) {
    return {
      state: { ...state, awaiting: 'finish', finishPreferenceAsked: true },
      messages: [`Any finish preference for the ${state.size}" options — black, chrome, machined, bronze, or show all?`],
    }
  }

  const cards = searchCards(state)
  const resultUrl = resultUrlFor(cards)
  const nextState: SmsDemoState = {
    ...state,
    awaiting: null,
    lastResultIds: cards.map(card => card.id),
  }

  return {
    state: nextState,
    messages: [
      `I found ${cards.length} stocked ${state.size}" option${cards.length === 1 ? '' : 's'} for ${describeVehicle(state.vehicle)}${state.finish ? ` in ${state.finish}` : ''}.`,
      summarizeCards(cards),
      'Want me to email these cards and ATD buy links? Reply with an email address.',
    ],
    cards,
    resultUrl,
  }
}
