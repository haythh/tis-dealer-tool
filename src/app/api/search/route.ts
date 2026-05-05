import { NextRequest, NextResponse } from 'next/server'
import { getDb, normalizeBoltPattern, type Wheel, type Vehicle } from '@/lib/db'
import { GoogleGenerativeAI } from '@google/generative-ai'

interface ParsedQuery {
  vehicle: { year: number | null; make: string; model: string } | null
  wheelModel: string | null
  size: string | null
  finish: string | null
  boltPattern: string | null
  brand: string | null
}

type FitmentStatus = 'exact' | 'bolt_pattern' | 'demo_fallback' | 'catalog_search'
type VehicleSegment = 'truck' | 'passenger'

const SERIES_MODELS = new Set(['1500', '2500', '3500'])

function hasBmwIxContext(query: string): boolean {
  return /\bbmw\b(?=[\s\S]{0,40}\bi[-\s]?x\b)/i.test(query)
}

function isSafeTokenPresent(query: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
  return new RegExp(`\\b${escaped}\\b`, 'i').test(query)
}

function requestedSeries(query: string): string | null {
  return query.toLowerCase().match(/\b(1500|2500|3500)\b/)?.[1] || null
}

function canonicalizeVehicle(vehicle: ParsedQuery['vehicle'], query: string): ParsedQuery['vehicle'] {
  if (!vehicle) return vehicle
  const make = vehicle.make
  const model = (vehicle.model || '').trim()
  const modelLower = model.toLowerCase()
  const series = requestedSeries(query)

  if (hasBmwIxContext(query)) {
    return { ...vehicle, make: 'BMW', model: 'iX' }
  }

  if (make === 'BMW' && /^(ix|i-x|i x)$/i.test(model)) {
    return { ...vehicle, make: 'BMW', model: 'iX' }
  }

  if (make === 'Chevrolet') {
    if (SERIES_MODELS.has(model) || ((modelLower === 'silverado' || !model) && series && /\b(chevy|chevrolet|silverado)\b/i.test(query))) {
      return { ...vehicle, model: `Silverado ${series || model}` }
    }
  }

  if (make === 'GMC') {
    if (SERIES_MODELS.has(model) || ((modelLower === 'sierra' || !model) && series && /\b(gmc|sierra)\b/i.test(query))) {
      return { ...vehicle, model: `Sierra ${series || model}` }
    }
  }

  if (make === 'RAM' || make === 'Dodge') {
    if (modelLower === 'ram' && series) return { ...vehicle, make: 'RAM', model: series }
    if (SERIES_MODELS.has(model)) return { ...vehicle, make: 'RAM', model }
  }

  return vehicle
}

function seriesClarificationPrompt(vehicle: ParsedQuery['vehicle']): string | null {
  if (!vehicle?.model) return null
  const model = vehicle.model.toLowerCase()
  if (vehicle.make === 'Chevrolet' && model === 'silverado') return 'Which Silverado: 1500, 2500, or 3500? Bolt pattern changes, so I won’t guess-fit it.'
  if (vehicle.make === 'GMC' && model === 'sierra') return 'Which Sierra: 1500, 2500, or 3500? Bolt pattern changes, so I won’t guess-fit it.'
  if (vehicle.make === 'RAM' && model === 'ram') return 'Which RAM model: 1500, 2500, or 3500? Bolt pattern changes, so I won’t guess-fit it.'
  return null
}

function shouldExactMatchVehicleModel(_make: string | null, model: string | null) {
  // Vehicle fitment must not infer across model names. Parser aliases should canonicalize
  // to seed-table names before this point; if they do not, prefer no match over guess-fit.
  return Boolean(model?.trim())
}

function vehicleSegmentFromRows(rows: { segment?: string | null }[]): VehicleSegment | null {
  if (!rows.length) return null
  return rows.every(row => row.segment === 'passenger') ? 'passenger' : 'truck'
}

function passengerBrandNotice(vehicleLabel: string, requestedBrand?: string | null) {
  return requestedBrand && requestedBrand !== 'TIS Motorsports'
    ? `Passenger-car demo fitments are limited to TIS Motorsports wheels. I’m not showing ${requestedBrand} as a confirmed fit for ${vehicleLabel}.`
    : `Passenger-car demo fitment matched ${vehicleLabel}; showing TIS Motorsports options only. Confirm final fitment with ATDOnline.`
}

function selectedWheelFields() {
  return 'id, supplier_pn, oracle_id, brand, model, color_finish, size, offset_mm, bolt_pattern, hub_bore, placement, material, fitment_category, msrp, map_price, upc, image_url, atd_url, in_stock, stock_pickup, stock_today, stock_tomorrow, stock_national, total_stock, atd_image_url, ta_image_url, ta_images_json, stock_updated_at'
}

function demoFallbackWheels(db: ReturnType<typeof getDb>, parsed: ParsedQuery, inStockOnly: boolean): Wheel[] {
  const conditions = ['ta_image_url IS NOT NULL']
  const params: (string | number)[] = []

  if (parsed.brand) {
    conditions.push('UPPER(brand) = UPPER(?)')
    params.push(parsed.brand)
  }

  if (parsed.size) {
    conditions.push('size LIKE ?')
    params.push(`%${parsed.size}%`)
  }

  if (parsed.finish) {
    conditions.push('LOWER(color_finish) LIKE LOWER(?)')
    params.push(`%${parsed.finish}%`)
  }

  const stockCondition = inStockOnly ? 'AND in_stock = 1' : ''
  const q = `
    SELECT ${selectedWheelFields()}
    FROM wheels
    WHERE ${conditions.join(' AND ')} ${stockCondition}
    ORDER BY
      CASE WHEN ta_images_json LIKE '%"type":"video"%' THEN 0 ELSE 1 END,
      COALESCE(total_stock, 0) DESC,
      map_price ASC
    LIMIT 36
  `

  const wheels = db.prepare(q).all(...params) as Wheel[]
  if (wheels.length || !inStockOnly) return wheels

  return demoFallbackWheels(db, parsed, false)
}

async function parseQueryWithGemini(query: string): Promise<ParsedQuery> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return parseQueryFallback(query)
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `You are a wheel fitment assistant. Parse this dealer query and extract structured data. Return JSON only, no markdown, no explanation.

Query: "${query}"

Return this exact JSON structure:
{
  "vehicle": { "year": <number or null>, "make": "<string or null>", "model": "<string or null>" } or null,
  "wheelModel": "<wheel model number/name or null>",
  "size": "<diameter in inches as string or null>",
  "finish": "<color or finish description or null>",
  "boltPattern": "<bolt pattern like 6x5.50 or null>",
  "brand": "TIS, DTS, TIS Motorsports, or null"
}

Rules:
- year must be a 4-digit number or null
- make examples: Ford, Chevrolet, GMC, RAM, Toyota, Jeep, Nissan, Dodge, Honda, Tesla
- If the vehicle is mentioned, populate vehicle object; otherwise set to null
- For "F-150" or "F150", make="Ford", model="F-150"
- For "Silverado" or "Sierra", detect make properly
- wheelModel is the TIS wheel model number (e.g., "544", "554", "535")
- size is just the diameter number as string (e.g., "20", "22", "24")
- finish examples: "Black", "Chrome", "Machined", "Gloss Black", "Bronze"
- boltPattern only if explicitly mentioned
- brand: one of "TIS", "DTS", "TIS Motorsports" or null. Detect from keywords: "dropstars" or "dts" → "DTS", "motorsports" → "TIS Motorsports", "tis" alone → "TIS"`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return parseQueryFallback(query)
    return JSON.parse(jsonMatch[0]) as ParsedQuery
  } catch {
    return parseQueryFallback(query)
  }
}

function parseQueryFallback(query: string): ParsedQuery {
  const q = query.toLowerCase()
  const parsed: ParsedQuery = {
    vehicle: null,
    wheelModel: null,
    size: null,
    finish: null,
    boltPattern: null,
    brand: null,
  }

  // Extract year
  const yearMatch = q.match(/\b(19|20)\d{2}\b/)
  const year = yearMatch ? parseInt(yearMatch[0]) : null

  // Extract make
  const makes: Record<string, string> = {
    'ford': 'Ford', 'f-150': 'Ford', 'f150': 'Ford', 'f-250': 'Ford', 'f-350': 'Ford',
    'ranger': 'Ford', 'bronco': 'Ford', 'explorer': 'Ford', 'expedition': 'Ford', 'mustang': 'Ford',
    'chevy': 'Chevrolet', 'chevrolet': 'Chevrolet', 'silverado': 'Chevrolet', 'colorado': 'Chevrolet',
    'tahoe': 'Chevrolet', 'suburban': 'Chevrolet', 'camaro': 'Chevrolet', 'corvette': 'Chevrolet',
    'gmc': 'GMC', 'sierra': 'GMC', 'canyon': 'GMC', 'yukon': 'GMC',
    'ram': 'RAM', 'dodge': 'Dodge', 'challenger': 'Dodge', 'charger': 'Dodge',
    'toyota': 'Toyota', 'tacoma': 'Toyota', 'tundra': 'Toyota', '4runner': 'Toyota',
    'camry': 'Toyota', 'corolla': 'Toyota', 'rav4': 'Toyota', 'highlander': 'Toyota',
    'sequoia': 'Toyota', 'land cruiser': 'Toyota',
    'jeep': 'Jeep', 'wrangler': 'Jeep', 'gladiator': 'Jeep', 'grand cherokee': 'Jeep',
    'nissan': 'Nissan', 'titan': 'Nissan', 'frontier': 'Nissan',
    'honda': 'Honda', 'ridgeline': 'Honda', 'pilot': 'Honda', 'accord': 'Honda', 'civic': 'Honda',
    'tesla': 'Tesla', 'cybertruck': 'Tesla',
    'bmw': 'BMW', 'x3': 'BMW', 'x5': 'BMW', 'x6': 'BMW', 'x7': 'BMW', 'i8': 'BMW',
    'mercedes': 'Mercedes-Benz', 'mercedes-benz': 'Mercedes-Benz', 'g wagon': 'Mercedes-Benz', 'g-wagon': 'Mercedes-Benz', 'sprinter': 'Mercedes-Benz',
    'audi': 'Audi', 'q5': 'Audi', 'q7': 'Audi', 'q8': 'Audi',
    'lexus': 'Lexus', 'gx': 'Lexus', 'lx': 'Lexus',
    'cadillac': 'Cadillac', 'escalade': 'Cadillac',
    'lincoln': 'Lincoln', 'navigator': 'Lincoln',
    'rivian': 'Rivian', 'r1t': 'Rivian', 'r1s': 'Rivian',
    'hyundai': 'Hyundai', 'santa cruz': 'Hyundai', 'palisade': 'Hyundai',
    'kia': 'Kia', 'telluride': 'Kia',
    'porsche': 'Porsche', 'cayenne': 'Porsche',
  }

  let detectedMake: string | null = null
  let detectedModel: string | null = null

  // Check for multi-word makes first
  if (q.includes('land cruiser')) { detectedMake = 'Toyota'; detectedModel = 'Land Cruiser' }
  else if (q.includes('grand cherokee')) { detectedMake = 'Jeep'; detectedModel = 'Grand Cherokee' }

  if (!detectedMake) {
    const modelMap: Record<string, string> = {
      'f-150': 'F-150', 'f150': 'F-150', 'f-250': 'F-250', 'f-350': 'F-350',
      'ranger': 'Ranger', 'bronco': 'Bronco', 'explorer': 'Explorer',
      'expedition': 'Expedition', 'mustang': 'Mustang',
      'silverado': 'Silverado', 'colorado': 'Colorado', 'tahoe': 'Tahoe',
      'suburban': 'Suburban', 'camaro': 'Camaro', 'corvette': 'Corvette',
      'sierra': 'Sierra', 'canyon': 'Canyon', 'yukon': 'Yukon',
      'challenger': 'Challenger', 'charger': 'Charger',
      'tacoma': 'Tacoma', 'tundra': 'Tundra', '4runner': '4Runner',
      'camry': 'Camry', 'corolla': 'Corolla', 'rav4': 'RAV4', 'highlander': 'Highlander',
      'sequoia': 'Sequoia',
      'wrangler': 'Wrangler', 'gladiator': 'Gladiator',
      'titan': 'Titan', 'frontier': 'Frontier',
      'ridgeline': 'Ridgeline', 'pilot': 'Pilot', 'accord': 'Accord', 'civic': 'Civic',
      'cybertruck': 'Cybertruck',
      'x3': 'X3', 'x5': 'X5', 'x6': 'X6', 'x7': 'X7', 'i8': 'i8',
      'g wagon': 'G Wagon', 'g-wagon': 'G Wagon', 'sprinter': 'Sprinter',
      'q5': 'Q5', 'q7': 'Q7', 'q8': 'Q8',
      'gx': 'GX', 'lx': 'LX', 'escalade': 'Escalade', 'navigator': 'Navigator',
      'r1t': 'R1T', 'r1s': 'R1S', 'santa cruz': 'Santa Cruz', 'palisade': 'Palisade',
      'telluride': 'Telluride', 'cayenne': 'Cayenne',
    }

    for (const [keyword, make] of Object.entries(makes)) {
      if (isSafeTokenPresent(query, keyword)) {
        detectedMake = make
        // Try to detect model
        if (modelMap[keyword]) detectedModel = modelMap[keyword]
        break
      }
    }

    if (hasBmwIxContext(query)) {
      detectedMake = 'BMW'
      detectedModel = 'iX'
    }

    if (detectedMake && !detectedModel) {
      for (const [keyword, model] of Object.entries(modelMap)) {
        if (isSafeTokenPresent(query, keyword)) {
          detectedModel = model
          break
        }
      }
    }
  }

  const series = requestedSeries(query)
  if (detectedMake === 'Chevrolet' && series && (!detectedModel || detectedModel === 'Silverado')) detectedModel = `Silverado ${series}`
  if (detectedMake === 'GMC' && series && (!detectedModel || detectedModel === 'Sierra')) detectedModel = `Sierra ${series}`

  // Detect RAM 1500/2500/3500 without defaulting ambiguous RAM to 1500
  if (q.includes('ram')) {
    detectedMake = 'RAM'
    if (series) detectedModel = series
    else detectedModel = 'RAM'
  }

  if (detectedMake) {
    parsed.vehicle = canonicalizeVehicle({ year, make: detectedMake, model: detectedModel || '' }, query)
  }

  // Extract size (diameter)
  const sizeMatch = q.match(/\b(17|18|19|20|22|24|26|28|30)\b/)
  if (sizeMatch) parsed.size = sizeMatch[0]

  // Extract wheel model number (TIS uses 3-digit numbers)
  const modelMatch = q.match(/\btis\s*(\d{3,4})\b/i) || q.match(/\b(\d{3,4})\b(?=\s|$)/)
  if (modelMatch) parsed.wheelModel = modelMatch[1]

  // Extract finish
  const finishes = ['gloss black', 'matte black', 'satin black', 'machined', 'gunmetal', 'chrome', 'black', 'bronze', 'silver', 'white', 'gold', 'blue', 'red']
  for (const finish of finishes) {
    const pattern = new RegExp(`\\b${finish.replace(/\\s+/g, '\\s+')}\\b`, 'i')
    if (pattern.test(q)) {
      parsed.finish = finish.charAt(0).toUpperCase() + finish.slice(1)
      break
    }
  }

  // Extract bolt pattern
  const bpMatch = q.match(/\b(\d)x(\d+\.?\d*)\b/i)
  if (bpMatch) parsed.boltPattern = bpMatch[0]

  // Extract brand
  if (q.includes('dts') || q.includes('dropstars')) parsed.brand = 'DTS'
  else if (q.includes('motorsports')) parsed.brand = 'TIS Motorsports'
  else if (q.includes('tis')) parsed.brand = 'TIS'
  else parsed.brand = null

  return parsed
}

export async function POST(request: NextRequest) {
  try {
    const { query, inStockOnly } = await request.json()
    if (!query?.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const parsed = await parseQueryWithGemini(query)
    const fallbackParsed = parseQueryFallback(query)
    if (hasBmwIxContext(query)) {
      parsed.vehicle = { year: fallbackParsed.vehicle?.year ?? parsed.vehicle?.year ?? null, make: 'BMW', model: 'iX' }
    }
    if (parsed.vehicle?.make && !parsed.vehicle.model && fallbackParsed.vehicle?.model) {
      parsed.vehicle = fallbackParsed.vehicle
    }
    if (fallbackParsed.vehicle?.make && fallbackParsed.vehicle.model) {
      const fallbackModelToken = fallbackParsed.vehicle.model.toLowerCase().replace(/\s+\d+$/, '')
      const parsedLooksDifferent = parsed.vehicle?.make !== fallbackParsed.vehicle.make || parsed.vehicle?.model !== fallbackParsed.vehicle.model
      if (parsedLooksDifferent && isSafeTokenPresent(query, fallbackModelToken)) {
        parsed.vehicle = fallbackParsed.vehicle
      }
    }
    parsed.vehicle = canonicalizeVehicle(parsed.vehicle, query)
    // Sanitize: if wheelModel looks like a year (4 digits, starts with 19/20), clear it
    if (parsed.wheelModel && /^(19|20)\d{2}$/.test(parsed.wheelModel)) {
      parsed.wheelModel = null
    }
    const db = getDb()

    let wheels: Wheel[] = []
    let fitmentStatus: FitmentStatus = 'catalog_search'
    let notice: string | null = null
    let matchedBoltPatterns: string[] = []

    // Strategy: if vehicle detected, look up bolt pattern first
    if (parsed.vehicle && parsed.vehicle.make && !parsed.vehicle.model) {
      notice = `I found ${parsed.vehicle.make}, but need the model before checking fitment. I’m not showing guess-fit wheels.`
    } else if (seriesClarificationPrompt(parsed.vehicle)) {
      notice = seriesClarificationPrompt(parsed.vehicle)
    } else if (parsed.vehicle && (parsed.vehicle.make || parsed.vehicle.model)) {
      const { year, make, model } = parsed.vehicle

      // Find matching vehicles
      let vehicleQuery = 'SELECT DISTINCT bolt_pattern, segment FROM vehicles WHERE 1=1'
      const vehicleParams: (string | number)[] = []

      if (make) {
        vehicleQuery += ' AND LOWER(make) = LOWER(?)'
        vehicleParams.push(make)
      }
      if (model) {
        if (shouldExactMatchVehicleModel(make, model)) {
          vehicleQuery += ' AND LOWER(model) = LOWER(?)'
          vehicleParams.push(model)
        } else {
          vehicleQuery += ' AND LOWER(model) LIKE LOWER(?)'
          vehicleParams.push(`%${model}%`)
        }
      }
      if (year && year > 0) {
        vehicleQuery += ' AND year_start <= ? AND year_end >= ?'
        vehicleParams.push(year, year)
      }

      const vehicleRows = db.prepare(vehicleQuery).all(...vehicleParams) as { bolt_pattern: string; segment: VehicleSegment }[]
      const boltPatterns = vehicleRows.map(r => r.bolt_pattern)
      const vehicleSegment = vehicleSegmentFromRows(vehicleRows)
      const vehicleLabel = [parsed.vehicle.year, parsed.vehicle.make, parsed.vehicle.model].filter(Boolean).join(' ')
      matchedBoltPatterns = [...new Set(boltPatterns)]

      if (boltPatterns.length > 0) {
        fitmentStatus = 'bolt_pattern'
        // Get all normalized variants
        const allPatterns = [...new Set(boltPatterns.flatMap(bp => normalizeBoltPattern(bp)))]

        const bpConditions = allPatterns.map(p => `UPPER(bolt_pattern) LIKE UPPER('%${p.replace(/'/g, "''")}%')`).join(' OR ')
        let wheelQuery = `SELECT ${selectedWheelFields()} FROM wheels WHERE (${bpConditions})`
        const wheelParams: (string | number)[] = []

        if (parsed.size) {
          wheelQuery += ' AND size LIKE ?'
          wheelParams.push(`%${parsed.size}%`)
        }
        if (parsed.wheelModel) {
          wheelQuery += ' AND (model LIKE ? OR supplier_pn LIKE ?)'
          wheelParams.push(`%${parsed.wheelModel}%`, `%${parsed.wheelModel}%`)
        }
        if (parsed.finish) {
          wheelQuery += ' AND LOWER(color_finish) LIKE LOWER(?)'
          wheelParams.push(`%${parsed.finish}%`)
        }
        if (vehicleSegment === 'passenger') {
          if (parsed.brand && parsed.brand !== 'TIS Motorsports') {
            wheels = []
            notice = passengerBrandNotice(vehicleLabel, parsed.brand)
            return NextResponse.json({
              wheels,
              query_parsed: parsed,
              total: 0,
              fitment_status: fitmentStatus,
              matched_bolt_patterns: matchedBoltPatterns,
              notice,
              suggested_queries: ['2022 Honda Accord 20 inch black', '2021 Toyota Camry 20 inch', '2023 BMW X5 22 inch', '2024 F-150 20 inch black'],
            })
          }
          wheelQuery += ' AND UPPER(brand) = UPPER(?)'
          wheelParams.push('TIS Motorsports')
        } else if (parsed.brand) {
          wheelQuery += ' AND UPPER(brand) = UPPER(?)'
          wheelParams.push(parsed.brand)
        }
        if (inStockOnly) {
          wheelQuery += ' AND in_stock = 1'
        }

        wheelQuery += ' ORDER BY map_price ASC LIMIT 100'
        wheels = db.prepare(wheelQuery).all(...wheelParams) as Wheel[]
        if (wheels.length > 0) {
          fitmentStatus = 'exact'
          notice = vehicleSegment === 'passenger'
            ? passengerBrandNotice(vehicleLabel)
            : `Demo fitment matched ${parsed.vehicle.year || ''} ${parsed.vehicle.make} ${parsed.vehicle.model} by bolt pattern${matchedBoltPatterns.length ? ` (${matchedBoltPatterns.join(', ')})` : ''}. Confirm final fitment with ATDOnline.`
        }
      } else {
        fitmentStatus = 'catalog_search'
        notice = `That vehicle is not in the demo fitment table yet, so I’m not showing guess-fit wheels. Search by bolt pattern/SKU or try a supported vehicle.`
      }
    }

    // Fallback: search by other criteria if no vehicle was detected.
    // If a vehicle was detected, do not fall back to unrelated catalog wheels; bad fitment is worse than no result.
    if (wheels.length === 0 && !parsed.vehicle) {
      const conditions: string[] = []
      const params: (string | number)[] = []

      if (parsed.wheelModel) {
        conditions.push('(model LIKE ? OR supplier_pn LIKE ?)')
        params.push(`%${parsed.wheelModel}%`, `%${parsed.wheelModel}%`)
      }
      if (parsed.size) {
        conditions.push('size LIKE ?')
        params.push(`%${parsed.size}%`)
      }
      if (parsed.finish) {
        conditions.push('LOWER(color_finish) LIKE LOWER(?)')
        params.push(`%${parsed.finish}%`)
      }
      if (parsed.boltPattern) {
        const patterns = normalizeBoltPattern(parsed.boltPattern)
        conditions.push(`UPPER(bolt_pattern) IN (${patterns.map(p => `UPPER('${p.replace(/'/g, "''")}')`).join(',')})`)
      }
      if (parsed.brand) {
        conditions.push('UPPER(brand) = UPPER(?)')
        params.push(parsed.brand)
      }

      if (conditions.length > 0) {
        const q = `SELECT ${selectedWheelFields()} FROM wheels WHERE ${conditions.join(' AND ')}${inStockOnly ? ' AND in_stock = 1' : ''} ORDER BY map_price ASC LIMIT 100`
        wheels = db.prepare(q).all(...params) as Wheel[]
      } else {
        // Full text fallback, search model, brand, finish
        const searchTerm = `%${query}%`
        wheels = db.prepare(`
          SELECT ${selectedWheelFields()} FROM wheels
          WHERE (model LIKE ? OR brand LIKE ? OR color_finish LIKE ? OR fitment_category LIKE ?)${inStockOnly ? ' AND in_stock = 1' : ''}
          ORDER BY map_price ASC LIMIT 100
        `).all(searchTerm, searchTerm, searchTerm, searchTerm) as Wheel[]
      }

      if (wheels.length > 0 && fitmentStatus !== 'exact') {
        fitmentStatus = parsed.boltPattern ? 'bolt_pattern' : 'catalog_search'
      }
    }

    if (wheels.length === 0 && parsed.vehicle) {
      notice = notice || `No confirmed TIS/DTS catalog match found for ${[parsed.vehicle.year, parsed.vehicle.make, parsed.vehicle.model].filter(Boolean).join(' ')}. I’m not showing guess-fit wheels.`
    }

    return NextResponse.json({
      wheels,
      query_parsed: parsed,
      total: wheels.length,
      fitment_status: fitmentStatus,
      matched_bolt_patterns: matchedBoltPatterns,
      notice,
      suggested_queries: ['2024 F-150', '2024 Silverado 1500', '2023 RAM 1500', '2024 Tacoma', '2024 Bronco', '6x5.50 20 inch black'],
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Search failed', wheels: [], total: 0, query_parsed: null }, { status: 500 })
  }
}
