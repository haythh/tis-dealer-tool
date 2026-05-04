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
  boltPattern?: string | null
  catalogTerms?: string[]
  stockFilter?: 'in_stock' | 'out_of_stock' | 'all'
}

type SmsDemoOptions = {
  baseUrl?: string
}

function currency(value: number | null) {
  return value ? `$${Math.round(value).toLocaleString()}` : 'TBD'
}

const WHEEL_FIELDS = 'id, supplier_pn, brand, model, color_finish, size, offset_mm, bolt_pattern, hub_bore, map_price, atd_url, in_stock, stock_today, stock_tomorrow, stock_national, total_stock, ta_image_url, atd_image_url'

const SEARCH_FIELDS = ['supplier_pn', 'model', 'color_finish', 'size', 'bolt_pattern', 'upc', 'brand']
const SEARCH_STOPWORDS = new Set([
  'what', 'which', 'show', 'find', 'have', 'with', 'wheel', 'wheels', 'rim', 'rims', 'about',
  'stock', 'stocked', 'available', 'availability', 'price', 'pricing', 'map', 'for', 'the',
  'and', 'that', 'are', 'all', 'any', 'options', 'option', 'catalog', 'data', 'demo',
  'inch', 'inches', 'send', 'email', 'quote', 'share', 'please', 'lookup', 'search',
  'out', 'oos', 'not',
])

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

  const size = lower.match(/\b(17|18|20|22|24|26|28|30)\s*(?:s|in|inch|inches|\")?\b/)?.[1] || null
  const boltPattern = lower.match(/\b([568]\s*x\s*(?:\d{3}(?:\.\d)?|\d(?:\.\d{1,2})?))\b/i)?.[1]?.replace(/\s+/g, '').toUpperCase() || null

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

  const stockFilter = /\bout of stock|not in stock|oos\b/.test(lower)
    ? 'out_of_stock'
    : /\ball catalog|all data|entire catalog|include out of stock|everything\b/.test(lower)
      ? 'all'
      : undefined

  const catalogTerms = [...new Set(
    q
      .replace(email || '', ' ')
      .match(/[a-z0-9][a-z0-9+.-]{1,}/gi)
      ?.map(term => term.toUpperCase())
      .filter(term => {
        const lowerTerm = term.toLowerCase()
        if (SEARCH_STOPWORDS.has(lowerTerm)) return false
        if (/^(19|20)\d{2}$/.test(term)) return false
        if (/^(17|18|20|22|24|26|28|30)S?$/.test(term)) return false
        if (['FORD', 'CHEVY', 'CHEVROLET', 'GMC', 'RAM', 'TOYOTA', 'JEEP'].includes(term)) return false
        if (['F150', 'F-150', 'F250', 'F-250', 'F350', 'F-350', 'SILVERADO', 'SIERRA', 'TACOMA', 'TUNDRA', '4RUNNER', 'WRANGLER', 'GLADIATOR', 'BRONCO', 'RANGER'].includes(term)) return false
        if (Object.keys(FINISH_TERMS).some(finishTerm => finishTerm.toUpperCase() === term)) return false
        return term.length >= 3 || /^[A-Z]\d+$/.test(term)
      }) || []
  )].slice(0, 5)

  return {
    vehicle: extractVehicle(q),
    size,
    finish,
    brand,
    wantsEmail: /\b(email|send|quote|share)\b/.test(lower),
    email,
    boltPattern,
    catalogTerms,
    stockFilter,
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

  if (next.awaiting === 'size' && /\b(all|any|show all|no preference|no pref|whatever)\b/.test(lower)) {
    next.size = 'all'
  }

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

function searchCards(state: SmsDemoState, parsed?: ParsedSms): SmsDemoCard[] {
  const db = getDb()
  const conditions: string[] = []
  const params: (string | number)[] = []

  if (parsed?.stockFilter === 'in_stock') {
    conditions.push('in_stock = 1')
  } else if (parsed?.stockFilter === 'out_of_stock') {
    conditions.push('COALESCE(in_stock, 0) = 0')
  }

  const boltPatterns = state.vehicle ? findBoltPatterns(state.vehicle) : []
  const requestedBoltPatterns = parsed?.boltPattern ? normalizeBoltPattern(parsed.boltPattern) : []
  const allBoltPatterns = [...new Set([...boltPatterns, ...requestedBoltPatterns])]
  if (allBoltPatterns.length) {
    conditions.push(`(${allBoltPatterns.map(() => `UPPER(bolt_pattern) LIKE UPPER(?)`).join(' OR ')})`)
    params.push(...allBoltPatterns.map(pattern => `%${pattern}%`))
  }

  if (state.size && state.size !== 'all') {
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

  for (const term of parsed?.catalogTerms || []) {
    conditions.push(`(${SEARCH_FIELDS.map(field => `UPPER(${field}) LIKE UPPER(?)`).join(' OR ')})`)
    params.push(...SEARCH_FIELDS.map(() => `%${term}%`))
  }

  const where = conditions.length ? conditions.join(' AND ') : '1=1'
  let cards = db.prepare(`
    SELECT ${WHEEL_FIELDS}
    FROM wheels
    WHERE ${where}
    ORDER BY COALESCE(in_stock, 0) DESC, COALESCE(total_stock, 0) DESC, map_price ASC
    LIMIT 6
  `).all(...params) as SmsDemoCard[]

  if (!cards.length && state.finish) {
    const relaxed = { ...state, finish: null }
    cards = searchCards(relaxed, parsed)
  }

  if (!cards.length && parsed?.catalogTerms && parsed.catalogTerms.length > 1) {
    const relaxedParsed = { ...parsed, catalogTerms: parsed.catalogTerms.slice(0, 1) }
    cards = searchCards({ ...state, finish: null }, relaxedParsed)
  }

  if (!cards.length) {
    cards = db.prepare(`
      SELECT ${WHEEL_FIELDS}
      FROM wheels
      ORDER BY COALESCE(in_stock, 0) DESC, COALESCE(total_stock, 0) DESC, map_price ASC
      LIMIT 6
    `).all() as SmsDemoCard[]
  }

  return cards
}

export function getSmsDemoCardsByIds(ids: number[]): SmsDemoCard[] {
  const cleanIds = [...new Set(ids.filter(id => Number.isInteger(id) && id > 0))].slice(0, 12)
  if (!cleanIds.length) return []

  const db = getDb()
  const placeholders = cleanIds.map(() => '?').join(',')
  return db.prepare(`
    SELECT ${WHEEL_FIELDS}
    FROM wheels
    WHERE id IN (${placeholders})
    ORDER BY CASE id ${cleanIds.map((id, index) => `WHEN ${id} THEN ${index}`).join(' ')} ELSE 999 END
  `).all(...cleanIds) as SmsDemoCard[]
}

export function getSmsDemoResultUrl(ids: number[], baseUrl?: string) {
  const cleanIds = ids.filter(id => Number.isInteger(id) && id > 0)
  if (!cleanIds.length) return undefined
  const idsParam = cleanIds.join(',')
  const path = `/sms-demo?results=${encodeURIComponent(idsParam)}`
  return baseUrl ? `${baseUrl.replace(/\/$/, '')}${path}` : path
}

function resultUrlFor(cards: SmsDemoCard[], baseUrl?: string) {
  const ids = cards.map(card => card.id)
  const url = getSmsDemoResultUrl(ids, baseUrl)
  if (!url) return baseUrl ? `${baseUrl.replace(/\/$/, '')}/sms-demo` : '/sms-demo'
  return url
}

function resultUrlForIds(ids: number[] | undefined, baseUrl?: string) {
  const url = getSmsDemoResultUrl(ids || [], baseUrl)
  if (!url) return undefined
  return url
}

function hasCatalogCriteria(parsed: ParsedSms, state: SmsDemoState) {
  return Boolean(
    parsed.boltPattern ||
    parsed.catalogTerms?.length ||
    parsed.stockFilter ||
    state.brand ||
    state.size ||
    state.finish ||
    state.vehicle?.make ||
    state.vehicle?.model
  )
}

function ordinalIndex(text: string) {
  const lower = text.toLowerCase()
  const ordinalMap: Record<string, number> = { first: 0, second: 1, third: 2, fourth: 3, fifth: 4, sixth: 5 }
  for (const [word, index] of Object.entries(ordinalMap)) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) return index
  }
  const numberMatch = lower.match(/#\s*([1-6])\b|\bnumber\s*([1-6])\b|\b([1-6])\b/)
  const value = numberMatch?.[1] || numberMatch?.[2] || numberMatch?.[3]
  return value ? parseInt(value, 10) - 1 : null
}

function formatCardDetail(card: SmsDemoCard) {
  const stock = typeof card.total_stock === 'number'
    ? `${card.total_stock} total (${card.stock_today ?? 0} today / ${card.stock_national ?? 0} national)`
    : 'stock shown in ATD'
  return `${card.brand} ${card.model} ${card.size} — ${card.color_finish}\nSKU: ${card.supplier_pn}\nMAP: ${currency(card.map_price)}\nStock: ${stock}\nBolt: ${card.bolt_pattern} · Offset: ${card.offset_mm || '—'} · Hub: ${card.hub_bore || '—'}${card.atd_url ? `\nATD: ${card.atd_url}` : ''}`
}

function summarizeCardList(cards: SmsDemoCard[]) {
  return cards.slice(0, 3).map((card, index) => {
    const price = card.map_price ? `$${Math.round(card.map_price)}` : 'price TBD'
    const stock = typeof card.total_stock === 'number' ? `${card.total_stock} available` : 'stock shown in ATD'
    return `${index + 1}) ${card.brand} ${card.model} ${card.size} — ${card.color_finish}, ${price}, ${stock}`
  }).join('\n')
}

function summarizeCards(cards: SmsDemoCard[]) {
  return summarizeCardList(cards)
}

function isConversationalFollowUp(text: string, incomingState: SmsDemoState, parsed: ParsedSms) {
  const lower = text.toLowerCase()
  if (!incomingState.lastResultIds?.length && !incomingState.vehicle) return false
  if (/\b(what about|how about|instead|same|those|that|these|them|more like|can you|do you have|got anything|anything in|any in)\b/.test(lower)) return true
  if (incomingState.vehicle && (parsed.size || parsed.finish) && !parsed.vehicle && !parsed.catalogTerms?.length && !parsed.boltPattern && !parsed.brand) return true
  return false
}

function handleLastResultConversation(text: string, incomingState: SmsDemoState, options: SmsDemoOptions): SmsDemoReply | null {
  const lastCards = getSmsDemoCardsByIds(incomingState.lastResultIds || [])
  if (!lastCards.length) return null

  const lower = text.toLowerCase()
  const selectedIndex = ordinalIndex(text)
  const selectedCard = selectedIndex === null
    ? (/\b(that one|this one|it|that|this)\b/.test(lower) && lastCards.length === 1 ? lastCards[0] : null)
    : lastCards[selectedIndex]

  if (/\b(cheapest|lowest price|least expensive)\b/.test(lower)) {
    const cards = [...lastCards].sort((a, b) => (a.map_price ?? Number.MAX_SAFE_INTEGER) - (b.map_price ?? Number.MAX_SAFE_INTEGER))
    return {
      state: { ...incomingState, lastResultIds: cards.map(card => card.id), awaiting: null },
      messages: ['Cheapest from the current set:', summarizeCardList(cards), 'Want one packaged up? Say “send the first one” or drop an email.'],
      cards,
      resultUrl: resultUrlFor(cards, options.baseUrl),
    }
  }

  if (/\b(most stock|highest stock|best stock|most available|availability)\b/.test(lower)) {
    const cards = [...lastCards].sort((a, b) => (b.total_stock ?? 0) - (a.total_stock ?? 0))
    return {
      state: { ...incomingState, lastResultIds: cards.map(card => card.id), awaiting: null },
      messages: ['Best availability from the current set:', summarizeCardList(cards), 'Want one packaged up? Say “send the first one” or drop an email.'],
      cards,
      resultUrl: resultUrlFor(cards, options.baseUrl),
    }
  }

  if (selectedCard && /\b(detail|details|spec|specs|price|map|stock|availability|offset|bolt|hub|link|atd|tell me about|what is)\b/.test(lower)) {
    return {
      state: { ...incomingState, lastResultIds: [selectedCard.id], awaiting: null },
      messages: [formatCardDetail(selectedCard), 'Want me to email this card and ATD link? Reply with an email address.'],
      cards: [selectedCard],
      resultUrl: resultUrlFor([selectedCard], options.baseUrl),
    }
  }

  if (selectedCard && /\b(send|share|quote|package|email|use|pick|choose)\b/.test(lower)) {
    return {
      state: { ...incomingState, lastResultIds: [selectedCard.id], awaiting: 'email' },
      messages: [`Got it — I’ll package ${selectedCard.brand} ${selectedCard.model} ${selectedCard.size} (${selectedCard.color_finish}). What email should I send it to?`],
      cards: [selectedCard],
      resultUrl: resultUrlFor([selectedCard], options.baseUrl),
    }
  }

  if (/\b(compare|recap|show those|show them|list again)\b/.test(lower)) {
    return {
      state: { ...incomingState, awaiting: null },
      messages: ['Here’s the current set again:', summarizeCardList(lastCards), 'Ask “cheapest,” “most stock,” “details on #2,” or “send the third one.”'],
      cards: lastCards,
      resultUrl: resultUrlFor(lastCards, options.baseUrl),
    }
  }

  return null
}

export function handleSmsDemoMessage(text: string, incomingState: SmsDemoState = {}, options: SmsDemoOptions = {}): SmsDemoReply {
  const parsed = parseSmsText(text)
  const state = mergeState(incomingState, parsed, text)
  const lower = text.toLowerCase()

  const lastResultReply = handleLastResultConversation(text, incomingState, options)
  if (lastResultReply) return lastResultReply

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
      messages: [`Got it — preparing the wheel-card package for ${parsed.email}.`],
      resultUrl: resultUrlForIds(state.lastResultIds, options.baseUrl),
      emailPreview: {
        to: parsed.email,
        subject: `TIS wheel options${state.vehicle ? ` for ${describeVehicle(state.vehicle)}` : ''}`,
        wheelCount: count,
      },
    }
  }

  const conversationalFollowUp = isConversationalFollowUp(text, incomingState, parsed)
  const standaloneCatalogSearch = Boolean(
    !conversationalFollowUp &&
    !parsed.vehicle &&
    incomingState.awaiting !== 'size' &&
    incomingState.awaiting !== 'finish' &&
    incomingState.awaiting !== 'email' &&
    (parsed.catalogTerms?.length || parsed.boltPattern || parsed.brand || parsed.stockFilter || parsed.size || parsed.finish) &&
    !/\b(same|this|that|current)\s+(truck|vehicle|fitment|one)\b/.test(lower)
  )
  const searchState: SmsDemoState = standaloneCatalogSearch
    ? {
        vehicle: null,
        size: parsed.size || null,
        finish: parsed.finish || null,
        brand: parsed.brand || null,
        email: state.email || null,
        finishPreferenceAsked: true,
      }
    : state
  const broadCatalogSearch = hasCatalogCriteria(parsed, searchState)

  if (!broadCatalogSearch && (!searchState.vehicle?.year || !searchState.vehicle?.make || !searchState.vehicle?.model)) {
    return {
      state: { ...state, awaiting: 'vehicle' },
      messages: ['Got it. What vehicle year, make, and model? Example: 2022 Ford F-150.'],
    }
  }

  if (!broadCatalogSearch && !searchState.size) {
    return {
      state: { ...searchState, awaiting: 'size' },
      messages: [`Nice. What wheel diameter for the ${describeVehicle(searchState.vehicle)} — 20, 22, 24, or show me all?`],
    }
  }

  if (!broadCatalogSearch && !searchState.finishPreferenceAsked && !searchState.finish && !/\b(all|any|show all)\b/.test(lower)) {
    return {
      state: { ...searchState, awaiting: 'finish', finishPreferenceAsked: true },
      messages: [`Any finish preference for the ${searchState.size}" options — black, chrome, machined, bronze, or show all?`],
    }
  }

  const cards = searchCards(searchState, parsed)
  const resultUrl = resultUrlFor(cards, options.baseUrl)
  const sizeLabel = searchState.size && searchState.size !== 'all' ? `${searchState.size}"` : 'catalog'
  const nextState: SmsDemoState = {
    ...searchState,
    awaiting: null,
    lastResultIds: cards.map(card => card.id),
  }

  return {
    state: nextState,
    messages: [
      `I found ${cards.length} ${sizeLabel} option${cards.length === 1 ? '' : 's'}${describeVehicle(searchState.vehicle) ? ` for ${describeVehicle(searchState.vehicle)}` : ''}${searchState.finish ? ` in ${searchState.finish}` : ''}.`,
      summarizeCards(cards),
      'Want me to email these cards and ATD buy links? Reply with an email address.',
    ],
    cards,
    resultUrl,
  }
}
