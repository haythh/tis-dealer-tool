import Database from 'better-sqlite3'
import path from 'path'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'data', 'dealer-tool.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  }
  return db
}

export type Wheel = {
  id: number
  supplier_pn: string
  oracle_id: string | null
  brand: string
  model: string
  color_finish: string
  size: string
  offset_mm: string
  bolt_pattern: string
  hub_bore: string
  placement: string
  material: string
  fitment_category: string
  msrp: number | null
  map_price: number | null
  upc: string
  image_url: string | null
  atd_url: string | null
  in_stock: number | null
  stock_pickup: number | null
  stock_today: number | null
  stock_tomorrow: number | null
  stock_national: number | null
  total_stock: number | null
  atd_image_url: string | null
  ta_image_url: string | null
  ta_images_json: string | null
  stock_updated_at: string | null
}

export type Vehicle = {
  id: number
  year_start: number
  year_end: number
  make: string
  model: string
  bolt_pattern: string
  lug_count: number
}

// Normalize bolt pattern to both inch and mm formats for matching
export function normalizeBoltPattern(bp: string): string[] {
  const bpMap: Record<string, string[]> = {
    '6x5.50': ['6x5.50', '6x139.7', '6X5.50', '6X139.7'],
    '6x139.7': ['6x5.50', '6x139.7', '6x139', '6X5.50', '6X139.7', '6X139'],
    '6x139': ['6x5.50', '6x139.7', '6x139', '6X5.50', '6X139.7', '6X139'],
    '5x5.00': ['5x5.00', '5x127', '5X5.00', '5X127'],
    '5x127': ['5x5.00', '5x127', '5X5.00', '5X127'],
    '5x4.50': ['5x4.50', '5x114.3', '5X4.50', '5X114.3'],
    '5x114.3': ['5x4.50', '5x114.3', '5X4.50', '5X114.3'],
    '5x4.75': ['5x4.75', '5x120', '5X4.75', '5X120'],
    '5x120': ['5x4.75', '5x120', '5X4.75', '5X120'],
    '5x5.50': ['5x5.50', '5x139.7', '5X5.50', '5X139.7'],
    '5x139.7': ['5x5.50', '5x139.7', '5X5.50', '5X139.7'],
    '8x6.50': ['8x6.50', '8x165.1', '8X6.50', '8X165.1'],
    '8x165.1': ['8x6.50', '8x165.1', '8X6.50', '8X165.1'],
    '8x180': ['8x180', '8X180'],
    '6x135': ['6x135', '6X135'],
    '8x170': ['8x170', '8X170'],
    '5x150': ['5x150', '5X150'],
  }
  const normalized = bp?.toLowerCase().replace('x', 'x')
  for (const [key, variants] of Object.entries(bpMap)) {
    if (key.toLowerCase() === normalized || variants.map(v => v.toLowerCase()).includes(normalized)) {
      return variants
    }
  }
  return [bp]
}
