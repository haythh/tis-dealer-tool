import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const RT1_IMAGES = [
  '/tire-images/rt1/angle-1.webp',
  '/tire-images/rt1/angle-2.webp',
  '/tire-images/rt1/angle-3.webp',
]

const TT1_IMAGES_BY_BASE_SIZE = {
  '33X12.50R17': ['/tire-images/tt1/33x12-50r17/face.webp', '/tire-images/tt1/33x12-50r17/angle.webp'],
  '35X12.50R20': ['/tire-images/tt1/35x12-50r20/face.webp', '/tire-images/tt1/35x12-50r20/angle.webp'],
  '35X12.50R22': ['/tire-images/tt1/35x12-50r22/face.webp', '/tire-images/tt1/35x12-50r22/angle.webp'],
  '37X13.50R20': ['/tire-images/tt1/37x13-50r20/face.webp', '/tire-images/tt1/37x13-50r20/angle.webp'],
  '37X13.50R22': ['/tire-images/tt1/37x13-50r22/face.webp', '/tire-images/tt1/37x13-50r22/angle.webp'],
  '37X13.50R24': ['/tire-images/tt1/37x13-50r24/face.webp', '/tire-images/tt1/37x13-50r24/angle.webp', '/tire-images/tt1/37x13-50r24/tread.webp'],
  '37X13.50R26': ['/tire-images/tt1/37x13-50r26/face.webp', '/tire-images/tt1/37x13-50r26/angle.webp', '/tire-images/tt1/37x13-50r26/tread.webp'],
}

function baseTireSize(size) {
  return String(size || '')
    .toUpperCase()
    .replace(/LT/g, '')
    .replace(/\/\d+$/, '')
    .replace(/XL$/, '')
    .replace(/^P(?=\d)/, '')
    .trim()
}

function localTireImagesFor(line, size) {
  if (line === 'RT1') return { imageUrls: RT1_IMAGES, imageMatch: 'rt1-shared' }

  const match = TT1_IMAGES_BY_BASE_SIZE[baseTireSize(size)]
  if (match) return { imageUrls: match, imageMatch: baseTireSize(size) }

  return { imageUrls: TT1_IMAGES_BY_BASE_SIZE['35X12.50R20'], imageMatch: 'fallback-35X12.50R20' }
}

const SOURCES = [
  {
    line: 'RT1',
    name: 'TIS RT1 by Hercules',
    terrain: 'Rugged Terrain',
    sourceUrl: 'https://tiswheels.com/rt1/',
    heroImageUrl: 'https://tiswheels.com/wp-content/uploads/2025/04/rt1-web-block-copy-3.webp',
    logoUrl: 'https://tiswheels.com/wp-content/uploads/2025/03/rt1-smalllogo.webp',
    columns: [
      'itemNo', 'size', 'weight', 'volume', 'length', 'width', 'height', 'sectionWidth', 'rimDiameter',
      'tirePly', 'loadRange', 'sidewall', 'loadIndex', 'speedRating', 'treadDepth', 'tireDiameter',
      'minRimWidth', 'maxRimWidth', 'singleMaxLoad', 'dualMaxLoad',
    ],
  },
  {
    line: 'TT1',
    name: 'TIS TT1 by Hercules',
    terrain: 'Mud Terrain',
    sourceUrl: 'https://tiswheels.com/tt1/',
    heroImageUrl: 'https://tiswheels.com/wp-content/uploads/2022/03/tistires.webp',
    logoUrl: 'https://tiswheels.com/wp-content/uploads/2023/01/TT1-smallwhite.webp',
    columns: [
      'size', 'tirePly', 'loadIndex', 'speedRating', 'loadRange', 'minRimWidth', 'maxRimWidth',
      'singleMaxLoad', 'maxTirePressure', 'treadDepth', 'weight', 'retailPrice',
    ],
  },
]

function stripTags(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#8211;/g, '–')
    .replace(/&#x?27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractRows(html) {
  const table = html.match(/<table[\s\S]*?<\/table>/i)?.[0]
  if (!table) throw new Error('No table found')

  return [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)]
    .map(rowMatch => [...rowMatch[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(cell => stripTags(cell[1])))
    .filter(row => row.length)
}

function normalizeNumber(value) {
  if (value == null || value === '') return null
  const cleaned = String(value).replace(/[$,]/g, '').trim()
  if (!cleaned || cleaned.toUpperCase() === 'TBD' || cleaned === '-') return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : value
}

function normalizePrice(value) {
  if (!value) return null
  if (String(value).trim().toUpperCase() === 'TBD') return 'TBD'
  const numeric = normalizeNumber(value)
  return typeof numeric === 'number' ? numeric : null
}

function tireId(line, row) {
  const raw = row.itemNo || `${line}-${row.size}`
  return `${line}-${String(raw).replace(/[^A-Z0-9.]+/gi, '-').replace(/^-|-$/g, '')}`
}

async function scrapeSource(source) {
  const response = await fetch(source.sourceUrl, { headers: { 'user-agent': 'Mozilla/5.0 TIS Dealer Tool scraper' } })
  if (!response.ok) throw new Error(`${source.sourceUrl} returned ${response.status}`)
  const html = await response.text()
  const rows = extractRows(html)
  const dataRows = rows.slice(1)

  return dataRows.map(values => {
    const row = Object.fromEntries(source.columns.map((key, index) => [key, values[index] || '']))
    const localImages = localTireImagesFor(source.line, row.size)
    const normalized = {
      id: tireId(source.line, row),
      line: source.line,
      name: source.name,
      terrain: source.terrain,
      sourceUrl: source.sourceUrl,
      heroImageUrl: localImages.imageUrls[0] || source.heroImageUrl,
      imageUrls: localImages.imageUrls,
      imageMatch: localImages.imageMatch,
      logoUrl: source.logoUrl,
      itemNo: row.itemNo || null,
      size: row.size,
      rimDiameter: normalizeNumber(row.rimDiameter || String(row.size || '').match(/R(\d{2})/i)?.[1]),
      tirePly: normalizeNumber(row.tirePly),
      loadRange: row.loadRange || null,
      loadIndex: row.loadIndex || null,
      speedRating: row.speedRating || null,
      sidewall: row.sidewall || 'BW',
      treadDepth: normalizeNumber(row.treadDepth),
      tireDiameter: normalizeNumber(row.tireDiameter || row.height),
      sectionWidth: normalizeNumber(row.sectionWidth || row.width),
      minRimWidth: normalizeNumber(row.minRimWidth),
      maxRimWidth: normalizeNumber(row.maxRimWidth),
      singleMaxLoad: row.singleMaxLoad || null,
      dualMaxLoad: row.dualMaxLoad || null,
      maxTirePressure: normalizeNumber(row.maxTirePressure || String(row.singleMaxLoad || '').match(/@(\d+)/)?.[1]),
      weight: normalizeNumber(row.weight),
      retailPrice: normalizePrice(row.retailPrice),
    }

    return normalized
  })
}

const tires = (await Promise.all(SOURCES.map(scrapeSource))).flat()
const generatedAt = new Date().toISOString()
const byLine = tires.reduce((acc, tire) => {
  acc[tire.line] = (acc[tire.line] || 0) + 1
  return acc
}, {})

const output = {
  generatedAt,
  source: 'tiswheels.com RT1/TT1 spec tables',
  counts: {
    total: tires.length,
    ...byLine,
    imageExactOrShared: tires.filter(tire => tire.imageMatch !== 'fallback-35X12.50R20').length,
    imageFallback: tires.filter(tire => tire.imageMatch === 'fallback-35X12.50R20').length,
  },
  tires,
}

mkdirSync(join(ROOT, 'src', 'data'), { recursive: true })
writeFileSync(join(ROOT, 'src', 'data', 'tis-tires.json'), `${JSON.stringify(output, null, 2)}\n`)
console.log(`Scraped ${tires.length} tires: ${Object.entries(byLine).map(([line, count]) => `${line} ${count}`).join(', ')}`)
