import { NextRequest, NextResponse } from 'next/server'
import { getDb, normalizeBoltPattern, type Wheel, type Vehicle } from '@/lib/db'
import { GoogleGenerativeAI } from '@google/generative-ai'

interface ParsedQuery {
  vehicle: { year: number; make: string; model: string } | null
  wheelModel: string | null
  size: string | null
  finish: string | null
  boltPattern: string | null
  brand: string | null
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
  "boltPattern": "<bolt pattern like 6x5.50 or null>"
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
    'sequoia': 'Toyota', 'land cruiser': 'Toyota',
    'jeep': 'Jeep', 'wrangler': 'Jeep', 'gladiator': 'Jeep', 'grand cherokee': 'Jeep',
    'nissan': 'Nissan', 'titan': 'Nissan', 'frontier': 'Nissan',
    'honda': 'Honda', 'ridgeline': 'Honda', 'pilot': 'Honda',
    'tesla': 'Tesla', 'cybertruck': 'Tesla',
  }

  let detectedMake: string | null = null
  let detectedModel: string | null = null

  // Check for multi-word makes first
  if (q.includes('land cruiser')) { detectedMake = 'Toyota'; detectedModel = 'Land Cruiser' }
  else if (q.includes('grand cherokee')) { detectedMake = 'Jeep'; detectedModel = 'Grand Cherokee' }

  if (!detectedMake) {
    for (const [keyword, make] of Object.entries(makes)) {
      if (q.includes(keyword)) {
        detectedMake = make
        // Try to detect model
        const modelMap: Record<string, string> = {
          'f-150': 'F-150', 'f150': 'F-150', 'f-250': 'F-250', 'f-350': 'F-350',
          'ranger': 'Ranger', 'bronco': 'Bronco', 'explorer': 'Explorer',
          'expedition': 'Expedition', 'mustang': 'Mustang',
          'silverado': 'Silverado', 'colorado': 'Colorado', 'tahoe': 'Tahoe',
          'suburban': 'Suburban', 'camaro': 'Camaro', 'corvette': 'Corvette',
          'sierra': 'Sierra', 'canyon': 'Canyon', 'yukon': 'Yukon',
          'challenger': 'Challenger', 'charger': 'Charger',
          'tacoma': 'Tacoma', 'tundra': 'Tundra', '4runner': '4Runner',
          'sequoia': 'Sequoia',
          'wrangler': 'Wrangler', 'gladiator': 'Gladiator',
          'titan': 'Titan', 'frontier': 'Frontier',
          'ridgeline': 'Ridgeline', 'pilot': 'Pilot',
          'cybertruck': 'Cybertruck',
        }
        if (modelMap[keyword]) detectedModel = modelMap[keyword]
        break
      }
    }
  }

  // Detect RAM 1500/2500/3500
  if (q.includes('ram') || q.includes('1500') || q.includes('2500') || q.includes('3500')) {
    if (q.includes('ram')) {
      detectedMake = 'RAM'
      if (q.includes('1500')) detectedModel = '1500'
      else if (q.includes('2500')) detectedModel = '2500'
      else if (q.includes('3500')) detectedModel = '3500'
      else detectedModel = '1500'
    }
  }

  if (detectedMake) {
    parsed.vehicle = { year: year || 0, make: detectedMake, model: detectedModel || '' }
  }

  // Extract size (diameter)
  const sizeMatch = q.match(/\b(17|18|19|20|22|24|26|28|30)\b/)
  if (sizeMatch) parsed.size = sizeMatch[0]

  // Extract wheel model number (TIS uses 3-digit numbers)
  const modelMatch = q.match(/\btis\s*(\d{3,4})\b/i) || q.match(/\b(\d{3,4})\b(?=\s|$)/)
  if (modelMatch) parsed.wheelModel = modelMatch[1]

  // Extract finish
  const finishes = ['chrome', 'black', 'gloss black', 'matte black', 'satin black', 'machined', 'bronze', 'gunmetal', 'silver', 'white', 'gold', 'blue', 'red']
  for (const finish of finishes) {
    if (q.includes(finish)) {
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
    // Sanitize: if wheelModel looks like a year (4 digits, starts with 19/20), clear it
    if (parsed.wheelModel && /^(19|20)\d{2}$/.test(parsed.wheelModel)) {
      parsed.wheelModel = null
    }
    const db = getDb()

    let wheels: Wheel[] = []

    // Strategy: if vehicle detected, look up bolt pattern first
    if (parsed.vehicle && (parsed.vehicle.make || parsed.vehicle.model)) {
      const { year, make, model } = parsed.vehicle

      // Find matching vehicles
      let vehicleQuery = 'SELECT DISTINCT bolt_pattern FROM vehicles WHERE 1=1'
      const vehicleParams: (string | number)[] = []

      if (make) {
        vehicleQuery += ' AND LOWER(make) = LOWER(?)'
        vehicleParams.push(make)
      }
      if (model) {
        vehicleQuery += ' AND LOWER(model) LIKE LOWER(?)'
        vehicleParams.push(`%${model}%`)
      }
      if (year && year > 0) {
        vehicleQuery += ' AND year_start <= ? AND year_end >= ?'
        vehicleParams.push(year, year)
      }

      const vehicleRows = db.prepare(vehicleQuery).all(...vehicleParams) as { bolt_pattern: string }[]
      const boltPatterns = vehicleRows.map(r => r.bolt_pattern)

      if (boltPatterns.length > 0) {
        // Get all normalized variants
        const allPatterns = [...new Set(boltPatterns.flatMap(bp => normalizeBoltPattern(bp)))]
        const placeholders = allPatterns.map(() => '?').join(',')

        const bpConditions = allPatterns.map(p => `UPPER(bolt_pattern) LIKE UPPER('%${p.replace(/'/g, "''")}%')`).join(' OR ')
        let wheelQuery = `SELECT id, supplier_pn, oracle_id, brand, model, color_finish, size, offset_mm, bolt_pattern, hub_bore, placement, material, fitment_category, msrp, map_price, upc, image_url, atd_url, in_stock, stock_pickup, stock_today, stock_tomorrow, stock_national, total_stock, atd_image_url, ta_image_url, ta_images_json, stock_updated_at FROM wheels WHERE (${bpConditions})`
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
        if (parsed.brand) {
          wheelQuery += ' AND UPPER(brand) = UPPER(?)'
          wheelParams.push(parsed.brand)
        }
        if (inStockOnly) {
          wheelQuery += ' AND in_stock = 1'
        }

        wheelQuery += ' ORDER BY map_price ASC LIMIT 100'
        wheels = db.prepare(wheelQuery).all(...wheelParams) as Wheel[]
      }
    }

    // Fallback: search by other criteria if no vehicle or no results
    if (wheels.length === 0) {
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
        const q = `SELECT id, supplier_pn, oracle_id, brand, model, color_finish, size, offset_mm, bolt_pattern, hub_bore, placement, material, fitment_category, msrp, map_price, upc, image_url, atd_url, in_stock, stock_pickup, stock_today, stock_tomorrow, stock_national, total_stock, atd_image_url, ta_image_url, ta_images_json, stock_updated_at FROM wheels WHERE ${conditions.join(' AND ')}${inStockOnly ? ' AND in_stock = 1' : ''} ORDER BY map_price ASC LIMIT 100`
        wheels = db.prepare(q).all(...params) as Wheel[]
      } else {
        // Full text fallback, search model, brand, finish
        const searchTerm = `%${query}%`
        wheels = db.prepare(`
          SELECT id, supplier_pn, oracle_id, brand, model, color_finish, size, offset_mm, bolt_pattern, hub_bore, placement, material, fitment_category, msrp, map_price, upc, image_url, atd_url, in_stock, stock_pickup, stock_today, stock_tomorrow, stock_national, total_stock, atd_image_url, ta_image_url, ta_images_json, stock_updated_at FROM wheels 
          WHERE (model LIKE ? OR brand LIKE ? OR color_finish LIKE ? OR fitment_category LIKE ?)${inStockOnly ? ' AND in_stock = 1' : ''}
          ORDER BY map_price ASC LIMIT 100
        `).all(searchTerm, searchTerm, searchTerm, searchTerm) as Wheel[]
      }
    }

    return NextResponse.json({
      wheels,
      query_parsed: parsed,
      total: wheels.length,
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Search failed', wheels: [], total: 0, query_parsed: null }, { status: 500 })
  }
}
