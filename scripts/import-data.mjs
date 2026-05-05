import { readFileSync } from 'fs'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'
import Database from 'better-sqlite3'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// Ensure data directory exists
mkdirSync(join(ROOT, 'data'), { recursive: true })

console.log('📦 TIS Dealer Tool — Data Import')
console.log('=================================\n')

// ============================================================
// VEHICLE DATA
// ============================================================
const VEHICLES = [
  // Ford
  { year_start: 2015, year_end: 2026, make: 'Ford', model: 'F-150', bolt_pattern: '6x135', lug_count: 6 },
  { year_start: 2005, year_end: 2026, make: 'Ford', model: 'F-250', bolt_pattern: '8x170', lug_count: 8 },
  { year_start: 2005, year_end: 2026, make: 'Ford', model: 'F-350', bolt_pattern: '8x170', lug_count: 8 },
  { year_start: 2019, year_end: 2026, make: 'Ford', model: 'Ranger', bolt_pattern: '6x139.7', lug_count: 6 },
  { year_start: 2021, year_end: 2026, make: 'Ford', model: 'Bronco', bolt_pattern: '6x139.7', lug_count: 6 },
  { year_start: 2020, year_end: 2026, make: 'Ford', model: 'Explorer', bolt_pattern: '5x114.3', lug_count: 5 },
  { year_start: 2018, year_end: 2026, make: 'Ford', model: 'Expedition', bolt_pattern: '6x135', lug_count: 6 },
  { year_start: 2015, year_end: 2026, make: 'Ford', model: 'Mustang', bolt_pattern: '5x114.3', lug_count: 5 },
  { year_start: 2000, year_end: 2014, make: 'Ford', model: 'F-150', bolt_pattern: '5x135', lug_count: 5 },
  { year_start: 2003, year_end: 2014, make: 'Ford', model: 'Expedition', bolt_pattern: '5x135', lug_count: 5 },
  { year_start: 2011, year_end: 2019, make: 'Ford', model: 'Explorer', bolt_pattern: '5x114.3', lug_count: 5 },
  // Chevrolet
  { year_start: 2014, year_end: 2026, make: 'Chevrolet', model: 'Silverado 1500', bolt_pattern: '6x139.7', lug_count: 6 },
  { year_start: 2011, year_end: 2026, make: 'Chevrolet', model: 'Silverado 2500', bolt_pattern: '8x180', lug_count: 8 },
  { year_start: 2011, year_end: 2026, make: 'Chevrolet', model: 'Silverado 3500', bolt_pattern: '8x180', lug_count: 8 },
  { year_start: 2015, year_end: 2026, make: 'Chevrolet', model: 'Colorado', bolt_pattern: '6x139.7', lug_count: 6 },
  { year_start: 2015, year_end: 2026, make: 'Chevrolet', model: 'Tahoe', bolt_pattern: '6x139.7', lug_count: 6 },
  { year_start: 2015, year_end: 2026, make: 'Chevrolet', model: 'Suburban', bolt_pattern: '6x139.7', lug_count: 6 },
  { year_start: 2016, year_end: 2026, make: 'Chevrolet', model: 'Camaro', bolt_pattern: '5x120', lug_count: 5 },
  { year_start: 2014, year_end: 2026, make: 'Chevrolet', model: 'Corvette', bolt_pattern: '5x120', lug_count: 5 },
  { year_start: 1999, year_end: 2013, make: 'Chevrolet', model: 'Silverado 1500', bolt_pattern: '6x139.7', lug_count: 6 },
  { year_start: 2001, year_end: 2010, make: 'Chevrolet', model: 'Silverado 2500', bolt_pattern: '8x165.1', lug_count: 8 },
  // GMC
  { year_start: 2014, year_end: 2026, make: 'GMC', model: 'Sierra 1500', bolt_pattern: '6x139.7', lug_count: 6 },
  { year_start: 2011, year_end: 2026, make: 'GMC', model: 'Sierra 2500', bolt_pattern: '8x180', lug_count: 8 },
  { year_start: 2011, year_end: 2026, make: 'GMC', model: 'Sierra 3500', bolt_pattern: '8x180', lug_count: 8 },
  { year_start: 2015, year_end: 2026, make: 'GMC', model: 'Canyon', bolt_pattern: '6x139.7', lug_count: 6 },
  { year_start: 2015, year_end: 2026, make: 'GMC', model: 'Yukon', bolt_pattern: '6x139.7', lug_count: 6 },
  { year_start: 2015, year_end: 2026, make: 'GMC', model: 'Yukon XL', bolt_pattern: '6x139.7', lug_count: 6 },
  // RAM
  { year_start: 2012, year_end: 2018, make: 'RAM', model: '1500', bolt_pattern: '5x139.7', lug_count: 5 },
  { year_start: 2019, year_end: 2026, make: 'RAM', model: '1500', bolt_pattern: '6x139.7', lug_count: 6 },
  { year_start: 2012, year_end: 2026, make: 'RAM', model: '2500', bolt_pattern: '8x165.1', lug_count: 8 },
  { year_start: 2012, year_end: 2026, make: 'RAM', model: '3500', bolt_pattern: '8x165.1', lug_count: 8 },
  { year_start: 2019, year_end: 2026, make: 'RAM', model: '1500 Classic', bolt_pattern: '5x139.7', lug_count: 5 },
  // Toyota
  { year_start: 2005, year_end: 2026, make: 'Toyota', model: 'Tacoma', bolt_pattern: '6x139.7', lug_count: 6 },
  { year_start: 2007, year_end: 2021, make: 'Toyota', model: 'Tundra', bolt_pattern: '5x150', lug_count: 5 },
  { year_start: 2022, year_end: 2026, make: 'Toyota', model: 'Tundra', bolt_pattern: '6x139.7', lug_count: 6 },
  { year_start: 2010, year_end: 2026, make: 'Toyota', model: '4Runner', bolt_pattern: '6x139.7', lug_count: 6 },
  { year_start: 2018, year_end: 2026, make: 'Toyota', model: 'Camry', bolt_pattern: '5x114.3', lug_count: 5 },
  { year_start: 2019, year_end: 2026, make: 'Toyota', model: 'Corolla', bolt_pattern: '5x100', lug_count: 5 },
  { year_start: 2019, year_end: 2026, make: 'Toyota', model: 'RAV4', bolt_pattern: '5x114.3', lug_count: 5 },
  { year_start: 2020, year_end: 2026, make: 'Toyota', model: 'Highlander', bolt_pattern: '5x114.3', lug_count: 5 },
  { year_start: 2023, year_end: 2026, make: 'Toyota', model: 'Sequoia', bolt_pattern: '6x139.7', lug_count: 6 },
  { year_start: 2008, year_end: 2022, make: 'Toyota', model: 'Sequoia', bolt_pattern: '5x150', lug_count: 5 },
  { year_start: 2024, year_end: 2026, make: 'Toyota', model: 'Land Cruiser', bolt_pattern: '6x139.7', lug_count: 6 },
  { year_start: 2003, year_end: 2021, make: 'Toyota', model: 'Land Cruiser', bolt_pattern: '5x150', lug_count: 5 },
  // Jeep
  { year_start: 2007, year_end: 2026, make: 'Jeep', model: 'Wrangler', bolt_pattern: '5x127', lug_count: 5 },
  { year_start: 2020, year_end: 2026, make: 'Jeep', model: 'Gladiator', bolt_pattern: '5x127', lug_count: 5 },
  { year_start: 2011, year_end: 2026, make: 'Jeep', model: 'Grand Cherokee', bolt_pattern: '5x127', lug_count: 5 },
  { year_start: 2022, year_end: 2026, make: 'Jeep', model: 'Grand Cherokee WL', bolt_pattern: '5x127', lug_count: 5 },
  { year_start: 2002, year_end: 2010, make: 'Jeep', model: 'Liberty', bolt_pattern: '5x114.3', lug_count: 5 },
  // Nissan
  { year_start: 2016, year_end: 2026, make: 'Nissan', model: 'Titan', bolt_pattern: '6x139.7', lug_count: 6 },
  { year_start: 2004, year_end: 2015, make: 'Nissan', model: 'Titan', bolt_pattern: '6x139.7', lug_count: 6 },
  { year_start: 2022, year_end: 2026, make: 'Nissan', model: 'Frontier', bolt_pattern: '6x139.7', lug_count: 6 },
  { year_start: 2005, year_end: 2021, make: 'Nissan', model: 'Frontier', bolt_pattern: '6x114.3', lug_count: 6 },
  { year_start: 2013, year_end: 2021, make: 'Nissan', model: 'Pathfinder', bolt_pattern: '5x114.3', lug_count: 5 },
  { year_start: 2017, year_end: 2026, make: 'Nissan', model: 'Armada', bolt_pattern: '6x139.7', lug_count: 6 },
  // Dodge
  { year_start: 2015, year_end: 2026, make: 'Dodge', model: 'Challenger', bolt_pattern: '5x114.3', lug_count: 5 },
  { year_start: 2015, year_end: 2026, make: 'Dodge', model: 'Charger', bolt_pattern: '5x114.3', lug_count: 5 },
  { year_start: 2011, year_end: 2026, make: 'Dodge', model: 'Durango', bolt_pattern: '5x127', lug_count: 5 },
  // Tesla
  { year_start: 2024, year_end: 2026, make: 'Tesla', model: 'Cybertruck', bolt_pattern: '6x139.7', lug_count: 6 },
  { year_start: 2012, year_end: 2026, make: 'Tesla', model: 'Model S', bolt_pattern: '5x120', lug_count: 5 },
  { year_start: 2016, year_end: 2026, make: 'Tesla', model: 'Model X', bolt_pattern: '5x120', lug_count: 5 },
  // Honda
  { year_start: 2017, year_end: 2026, make: 'Honda', model: 'Ridgeline', bolt_pattern: '5x114.3', lug_count: 5 },
  { year_start: 2016, year_end: 2026, make: 'Honda', model: 'Pilot', bolt_pattern: '5x114.3', lug_count: 5 },
  { year_start: 2017, year_end: 2026, make: 'Honda', model: 'CR-V', bolt_pattern: '5x114.3', lug_count: 5 },
  { year_start: 2018, year_end: 2026, make: 'Honda', model: 'Accord', bolt_pattern: '5x114.3', lug_count: 5 },
  { year_start: 2016, year_end: 2026, make: 'Honda', model: 'Civic', bolt_pattern: '5x114.3', lug_count: 5 },
  // Lexus
  { year_start: 2008, year_end: 2021, make: 'Lexus', model: 'GX', bolt_pattern: '6x139.7', lug_count: 6 },
  { year_start: 2008, year_end: 2026, make: 'Lexus', model: 'LX', bolt_pattern: '5x150', lug_count: 5 },
  // Cadillac
  { year_start: 2015, year_end: 2026, make: 'Cadillac', model: 'Escalade', bolt_pattern: '6x139.7', lug_count: 6 },
  { year_start: 2015, year_end: 2026, make: 'Cadillac', model: 'Escalade ESV', bolt_pattern: '6x139.7', lug_count: 6 },
  // Lincoln
  { year_start: 2018, year_end: 2026, make: 'Lincoln', model: 'Navigator', bolt_pattern: '6x135', lug_count: 6 },
  // Subaru
  { year_start: 2020, year_end: 2026, make: 'Subaru', model: 'Outback', bolt_pattern: '5x114.3', lug_count: 5 },
  { year_start: 2019, year_end: 2026, make: 'Subaru', model: 'Forester', bolt_pattern: '5x114.3', lug_count: 5 },
  // Hyundai / Kia
  { year_start: 2022, year_end: 2026, make: 'Hyundai', model: 'Santa Cruz', bolt_pattern: '5x114.3', lug_count: 5 },
  { year_start: 2018, year_end: 2026, make: 'Hyundai', model: 'Tucson', bolt_pattern: '5x114.3', lug_count: 5 },
  { year_start: 2016, year_end: 2026, make: 'Kia', model: 'Telluride', bolt_pattern: '5x114.3', lug_count: 5 },
  // Land Rover
  { year_start: 2010, year_end: 2026, make: 'Land Rover', model: 'Range Rover', bolt_pattern: '5x120', lug_count: 5 },
  { year_start: 2013, year_end: 2026, make: 'Land Rover', model: 'Range Rover Sport', bolt_pattern: '5x120', lug_count: 5 },
  { year_start: 2012, year_end: 2026, make: 'Land Rover', model: 'Discovery', bolt_pattern: '5x120', lug_count: 5 },
  // Mercedes
  { year_start: 2019, year_end: 2026, make: 'Mercedes-Benz', model: 'G-Class', bolt_pattern: '5x130', lug_count: 5 },
  { year_start: 2016, year_end: 2026, make: 'Mercedes-Benz', model: 'GLE', bolt_pattern: '5x112', lug_count: 5 },
  // BMW
  { year_start: 2018, year_end: 2026, make: 'BMW', model: 'X5', bolt_pattern: '5x112', lug_count: 5 },
  { year_start: 2020, year_end: 2026, make: 'BMW', model: 'X6', bolt_pattern: '5x112', lug_count: 5 },
  { year_start: 2022, year_end: 2026, make: 'BMW', model: 'iX', bolt_pattern: '5x112', lug_count: 5 },
  // Audi
  { year_start: 2019, year_end: 2026, make: 'Audi', model: 'Q7', bolt_pattern: '5x112', lug_count: 5 },
  { year_start: 2019, year_end: 2026, make: 'Audi', model: 'Q8', bolt_pattern: '5x112', lug_count: 5 },
  // Volkswagen
  { year_start: 2012, year_end: 2026, make: 'Volkswagen', model: 'Touareg', bolt_pattern: '5x130', lug_count: 5 },
  // Rivian
  { year_start: 2022, year_end: 2026, make: 'Rivian', model: 'R1T', bolt_pattern: '6x139.7', lug_count: 6 },
  { year_start: 2022, year_end: 2026, make: 'Rivian', model: 'R1S', bolt_pattern: '6x139.7', lug_count: 6 },
  // GMC Hummer EV
  { year_start: 2022, year_end: 2026, make: 'GMC', model: 'Hummer EV', bolt_pattern: '8x180', lug_count: 8 },
]

// ============================================================
// VEHICLE SEGMENT CLASSIFICATION
// ============================================================
const PASSENGER_VEHICLES = new Set([
  'Ford|Explorer', 'Ford|Mustang',
  'Chevrolet|Camaro', 'Chevrolet|Corvette',
  'Dodge|Challenger', 'Dodge|Charger', 'Dodge|Durango',
  'Tesla|Model S', 'Tesla|Model X',
  'Honda|Accord', 'Honda|Civic', 'Honda|Pilot', 'Honda|CR-V',
  'Toyota|Camry', 'Toyota|Corolla', 'Toyota|RAV4', 'Toyota|Highlander',
  'BMW|X3', 'BMW|X5', 'BMW|X6', 'BMW|X7', 'BMW|iX', 'BMW|i8',
  'Mercedes-Benz|GLE', 'Mercedes-Benz|C-Class', 'Mercedes-Benz|E-Class', 'Mercedes-Benz|S-Class',
  'Audi|Q5', 'Audi|Q7', 'Audi|Q8', 'Audi|A4', 'Audi|A6',
  'Hyundai|Tucson', 'Hyundai|Palisade',
  'Kia|Telluride', 'Kia|K5',
  'Subaru|Outback', 'Subaru|Forester',
  'Lexus|RX', 'Lexus|GX', 'Lexus|LX',
  'Land Rover|Range Rover', 'Land Rover|Range Rover Sport', 'Land Rover|Discovery',
  'Volkswagen|Touareg',
  'Porsche|Cayenne',
])

function vehicleSegment(v) {
  return PASSENGER_VEHICLES.has(`${v.make}|${v.model}`) ? 'passenger' : 'truck'
}

const VEHICLE_FITMENTS = VEHICLES.map(v => ({ ...v, segment: v.segment || vehicleSegment(v) }))

// ============================================================
// BRAND NORMALIZATION
// ============================================================
function normalizeBrand(raw) {
  const b = String(raw || '').trim()
  if (b.toLowerCase().includes('dropstars trail')) return 'DTS'
  if (b.toLowerCase().includes('motorsports')) return 'TIS Motorsports'
  if (b.toLowerCase() === 'tis') return 'TIS'
  return b || 'TIS'
}

// ============================================================
// BOLT PATTERN NORMALIZATION
// ============================================================
const BP_MAP = {
  '6x5.50': '6x139.7', '6X5.50': '6x139.7', '6x5.5': '6x139.7', '6X5.5': '6x139.7',
  '5x5.00': '5x127', '5X5.00': '5x127', '5x5.0': '5x127', '5X5.0': '5x127',
  '5x4.50': '5x114.3', '5X4.50': '5x114.3', '5x4.5': '5x114.3', '5X4.5': '5x114.3',
  '5x4.75': '5x120', '5X4.75': '5x120',
  '5x5.50': '5x139.7', '5X5.50': '5x139.7', '5x5.5': '5x139.7', '5X5.5': '5x139.7',
  '8x6.50': '8x165.1', '8X6.50': '8x165.1', '8x6.5': '8x165.1', '8X6.5': '8x165.1',
}

function normalizeBP(bp) {
  if (!bp) return bp
  const trimmed = String(bp).trim()
  return BP_MAP[trimmed] || trimmed
}

// ============================================================
// PARSE tis-full-catalog.xlsx
// ============================================================
console.log('📄 Reading tis-full-catalog.xlsx...')
const catalogPath = join(ROOT, 'tis-full-catalog.xlsx')
const catalogWb = XLSX.readFile(catalogPath)
const catalogSheet = catalogWb.Sheets[catalogWb.SheetNames[0]]

// Row 1 = headers (index 0), data starts at row 2 (index 1)
const catalogRaw = XLSX.utils.sheet_to_json(catalogSheet, { header: 1, defval: '' })
console.log(`  Total rows (including header): ${catalogRaw.length}`)
console.log(`  Headers:`, catalogRaw[0])

const catalogData = catalogRaw.slice(1).filter(row => row[0]) // skip header, filter empty
console.log(`  Data rows: ${catalogData.length}`)

// Column indices (0-based, confirmed from header inspection):
// 0:  Oracle #
// 2:  Supplier #
// 3:  UPC Code
// 7:  Brand
// 8:  Brand Style
// 10: Style Name
// 15: Size
// 16: Lug Ct
// 18: Bolt Pattern
// 19: LugxBolt #1
// 20: LugxBolt #2
// 22: Offset
// 24: Hub Bore
// 28: Finish Name
// 34: MAP Price

// ============================================================
// OPEN DATABASE
// ============================================================
const dbPath = join(ROOT, 'data', 'dealer-tool.db')
console.log(`\n💾 Opening database: ${dbPath}`)
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

// ============================================================
// CREATE TABLES (idempotent — drop and recreate)
// ============================================================
console.log('🗑️  Dropping existing tables...')
db.exec(`DROP TABLE IF EXISTS wheels`)
db.exec(`DROP TABLE IF EXISTS vehicles`)

console.log('🔨 Creating tables...')
db.exec(`
  CREATE TABLE wheels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_pn TEXT,
    oracle_id TEXT,
    brand TEXT,
    model TEXT,
    color_finish TEXT,
    size TEXT,
    offset_mm TEXT,
    bolt_pattern TEXT,
    hub_bore TEXT,
    placement TEXT,
    material TEXT,
    fitment_category TEXT,
    msrp REAL,
    map_price REAL,
    upc TEXT,
    image_url TEXT,
    atd_url TEXT
  )
`)

db.exec(`
  CREATE TABLE vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year_start INTEGER,
    year_end INTEGER,
    make TEXT,
    model TEXT,
    bolt_pattern TEXT,
    lug_count INTEGER,
    segment TEXT NOT NULL DEFAULT 'truck'
  )
`)

db.exec(`CREATE INDEX IF NOT EXISTS idx_wheels_bolt ON wheels(bolt_pattern)`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_wheels_model ON wheels(model)`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_wheels_size ON wheels(size)`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_wheels_upc ON wheels(upc)`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_wheels_brand ON wheels(brand)`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_vehicles_make ON vehicles(make)`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_vehicles_bolt ON vehicles(bolt_pattern)`)

// ============================================================
// INSERT WHEELS FROM CATALOG
// ============================================================
console.log('\n⚙️  Inserting wheel data from tis-full-catalog.xlsx...')

const insertWheel = db.prepare(`
  INSERT INTO wheels (supplier_pn, oracle_id, brand, model, color_finish, size, offset_mm, bolt_pattern, hub_bore, placement, material, fitment_category, msrp, map_price, upc, image_url, atd_url)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

let inserted = 0
let brandCounts = {}

const insertMany = db.transaction((rows) => {
  for (const row of rows) {
    const oracleId   = String(row[0]  || '').trim() || null
    const supplierPn = String(row[2]  || '').trim()
    const upc        = String(row[3]  || '').trim()
    const brandRaw   = String(row[7]  || '').trim()
    const brand      = normalizeBrand(brandRaw)
    const model      = String(row[8]  || '').trim()
    const size       = String(row[15] || '').trim()
    const bpRaw      = String(row[18] || '').trim()
    // Keep the full dual-pattern bolt pattern as-is (e.g. "6X135 / 6X5.50")
    // Also store normalized for search matching
    const boltPattern = bpRaw || normalizeBP(String(row[19] || '').trim())
    const offsetMm   = String(row[22] || '').trim()
    const hubBore    = String(row[24] || '').trim()
    const colorFinish = String(row[28] || '').trim()
    const mapPriceRaw = row[34]
    const mapPrice   = typeof mapPriceRaw === 'number'
      ? mapPriceRaw
      : (parseFloat(String(mapPriceRaw || '').replace(/[^0-9.]/g, '')) || null)

    const atdUrl = oracleId ? `https://atdonline.com/p/${oracleId}/detailPage` : null

    brandCounts[brand] = (brandCounts[brand] || 0) + 1

    insertWheel.run(
      supplierPn,
      oracleId,
      brand,
      model,
      colorFinish,
      size,
      offsetMm,
      boltPattern,
      hubBore,
      '',    // placement
      '',    // material
      '',    // fitment_category
      mapPrice, // msrp = MAP Price
      mapPrice, // map_price = MAP Price
      upc,
      null,  // image_url
      atdUrl
    )
    inserted++
  }
})

insertMany(catalogData)
console.log(`  ✅ Inserted: ${inserted} wheels`)
console.log(`  📊 By brand:`)
for (const [brand, count] of Object.entries(brandCounts)) {
  console.log(`     ${brand}: ${count}`)
}

// ============================================================
// INSERT VEHICLES
// ============================================================
console.log('\n🚗 Inserting vehicle fitment data...')

const insertVehicle = db.prepare(`
  INSERT INTO vehicles (year_start, year_end, make, model, bolt_pattern, lug_count, segment)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)

const insertVehicles = db.transaction((vehicles) => {
  for (const v of vehicles) {
    insertVehicle.run(v.year_start, v.year_end, v.make, v.model, v.bolt_pattern, v.lug_count, v.segment || vehicleSegment(v))
  }
})

insertVehicles(VEHICLE_FITMENTS)
console.log(`  ✅ Inserted: ${VEHICLE_FITMENTS.length} vehicle fitment records`)

// ============================================================
// VERIFY
// ============================================================
const wheelCount = db.prepare('SELECT COUNT(*) as c FROM wheels').get().c
const vehicleCount = db.prepare('SELECT COUNT(*) as c FROM vehicles').get().c
const withAtd = db.prepare('SELECT COUNT(*) as c FROM wheels WHERE atd_url IS NOT NULL').get().c
const withMap = db.prepare('SELECT COUNT(*) as c FROM wheels WHERE map_price IS NOT NULL').get().c

console.log('\n📊 Database Summary')
console.log('===================')
console.log(`  Wheels total:      ${wheelCount}`)
console.log(`  With ATD URL:      ${withAtd}`)
console.log(`  With MAP price:    ${withMap}`)
console.log(`  Vehicles total:    ${vehicleCount}`)

// Sample query
const sample = db.prepare(`
  SELECT w.brand, w.model, w.color_finish, w.bolt_pattern, w.size, w.map_price, w.atd_url
  FROM wheels w
  WHERE w.atd_url IS NOT NULL
  LIMIT 3
`).all()

console.log('\n🔍 Sample wheels with ATD URLs:')
sample.forEach(w => {
  console.log(`  [${w.brand}] ${w.model} | ${w.color_finish} | ${w.bolt_pattern} | ${w.size} | $${w.map_price} | ${w.atd_url}`)
})

// ============================================================
// STOCK COLUMNS & IMPORT ATD SCRAPE RESULTS
// ============================================================
try { db.exec("ALTER TABLE wheels ADD COLUMN in_stock INTEGER DEFAULT 1") } catch {}
try { db.exec("ALTER TABLE wheels ADD COLUMN stock_pickup INTEGER DEFAULT 0") } catch {}
try { db.exec("ALTER TABLE wheels ADD COLUMN stock_today INTEGER DEFAULT 0") } catch {}
try { db.exec("ALTER TABLE wheels ADD COLUMN stock_tomorrow INTEGER DEFAULT 0") } catch {}
try { db.exec("ALTER TABLE wheels ADD COLUMN stock_national INTEGER DEFAULT 0") } catch {}
try { db.exec("ALTER TABLE wheels ADD COLUMN total_stock INTEGER DEFAULT 0") } catch {}
try { db.exec("ALTER TABLE wheels ADD COLUMN atd_image_url TEXT") } catch {}
try { db.exec("ALTER TABLE wheels ADD COLUMN stock_updated_at TEXT") } catch {}

console.log('\n📦 Importing ATD stock data...')
const scrapeFile = join(__dirname, '..', 'data', 'atd-scrape-results.json')
try {
  const scrapeData = JSON.parse(readFileSync(scrapeFile, 'utf-8'))
  const stockUpdate = db.prepare(`
    UPDATE wheels SET
      in_stock = ?,
      stock_pickup = ?,
      stock_today = ?,
      stock_tomorrow = ?,
      stock_national = ?,
      total_stock = ?,
      atd_image_url = COALESCE(?, atd_image_url),
      stock_updated_at = ?
    WHERE oracle_id = ?
  `)
  let stockUpdated = 0
  const stockTxn = db.transaction(() => {
    for (const item of scrapeData) {
      const result = stockUpdate.run(
        item.inStock ? 1 : 0,
        item.stockPickup || 0,
        item.stockToday || 0,
        item.stockTomorrow || 0,
        item.stockNational || 0,
        item.totalStock || 0,
        item.imageUrl || null,
        item.scrapedAt || new Date().toISOString(),
        item.oracleId
      )
      if (result.changes > 0) stockUpdated++
    }
  })
  stockTxn()
  const inStock = db.prepare("SELECT COUNT(*) as c FROM wheels WHERE in_stock = 1 AND stock_updated_at IS NOT NULL").get().c
  const outStock = db.prepare("SELECT COUNT(*) as c FROM wheels WHERE in_stock = 0 AND stock_updated_at IS NOT NULL").get().c
  console.log(`  Stock updated: ${stockUpdated}`)
  console.log(`  In stock: ${inStock} | Out of stock: ${outStock}`)
} catch (e) {
  console.log('  ⚠️  No stock data file found or parse error — skipping stock import:', e.message)
}

// ============================================================
// IMPORT TOUGHASSETS IMAGES
// ============================================================
console.log('\n🖼️  Importing ToughAssets images...')
try {
  db.exec("ALTER TABLE wheels ADD COLUMN ta_image_url TEXT")
} catch {}
try {
  db.exec("ALTER TABLE wheels ADD COLUMN ta_images_json TEXT")
} catch {}

try {
  const taRes = await fetch('https://toughassets.com/api/public/tis/assets')
  const taData = await taRes.json()
  const taAssets = taData.assets || taData
  const imageAssets = taAssets.filter(a => a.categoryName === 'Wheels' || a.categoryName === 'Products')
  const videoAssets = taAssets.filter(a => a.categoryName === 'Videos')

  const normalizeTaModel = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')

  const extractTaModelCandidates = (asset) => {
    const candidates = []
    const addCandidate = (value) => {
      const cleaned = normalizeTaModel(value)
      if (cleaned && !candidates.includes(cleaned)) candidates.push(cleaned)
    }

    for (const tag of Array.isArray(asset?.tags) ? asset.tags : []) {
      if (String(tag || '').trim() && !String(tag).toLowerCase().startsWith('brand:')) addCandidate(tag)
    }

    const baseName = String(asset?.originalName || '').replace(/\.(png|jpg|webp|jpeg|mp4|mov|webm|m4v)$/i, '').trim()
    if (!baseName) return candidates

    const normalized = baseName
      .replace(/^dts[-_\s]*/i, '')
      .replace(/^tis[-_\s]*/i, '')
      .trim()

    const leadingModelMatch = normalized.match(/^([0-9]+[A-Z0-9]*)/i)
    if (leadingModelMatch) addCandidate(leadingModelMatch[1])

    addCandidate(normalized.split(/[-.\s]/)[0])
    addCandidate(baseName.split(/[-.\s]/)[0])

    return candidates
  }

  const detectImageType = (asset) => {
    const fileName = String(asset?.originalName || '').toLowerCase()
    if (fileName.includes('topangle')) return 'topangle'
    if (fileName.includes('face')) return 'face'
    if (fileName.includes('angle')) return 'angle'
    return 'other'
  }

  const isDuallyAsset = (asset) => {
    const fileName = String(asset?.originalName || '').toLowerCase()
    const tags = (Array.isArray(asset?.tags) ? asset.tags : []).map(tag => String(tag || '').toLowerCase())
    return fileName.includes('dually') || tags.some(tag => tag.includes('dually'))
  }

  const PRIORITY = ['face', 'angle', 'topangle', 'video', 'other']
  const taMapping = {}

  const addAssetForModels = (models, assetItem) => {
    for (const model of models) {
      if (!taMapping[model]) taMapping[model] = []
      const exists = taMapping[model].some(item => item.fullUrl === assetItem.fullUrl && item.type === assetItem.type)
      if (!exists) taMapping[model].push(assetItem)
    }
  }

  for (const asset of imageAssets) {
    const thumbUrl = asset.thumbUrl || `https://toughassets.com/api/file/${asset.id}`
    const fullUrl = `https://toughassets.com/api/file/${asset.id}`
    addAssetForModels(extractTaModelCandidates(asset), {
      url: thumbUrl,
      type: detectImageType(asset),
      fullUrl,
      isDually: isDuallyAsset(asset),
    })
  }

  for (const asset of videoAssets) {
    const fullUrl = `https://toughassets.com/api/file/${asset.id}`
    const displayUrl = asset.thumbUrl || fullUrl
    const models = (Array.isArray(asset?.tags) ? asset.tags : [])
      .map(tag => normalizeTaModel(tag))
      .filter(Boolean)
    addAssetForModels(models, {
      url: displayUrl,
      type: 'video',
      fullUrl,
      isDually: isDuallyAsset(asset),
    })
  }

  const finalizeAssets = (assets) => assets
    .sort((a, b) => PRIORITY.indexOf(a.type) - PRIORITY.indexOf(b.type))
    .slice(0, 4)

  const buildWheelCandidates = (rawModel) => {
    const candidates = []
    const addCandidate = (value) => {
      const cleaned = normalizeTaModel(value)
      if (cleaned && !candidates.includes(cleaned)) candidates.push(cleaned)
    }

    addCandidate(rawModel)
    addCandidate(rawModel.split(/[-.\s]/)[0])
    addCandidate(rawModel.replace(/\bDUALLY\b.*$/i, '').trim())
    addCandidate(rawModel.replace(/\b2\.0\b/ig, '').trim())
    addCandidate(rawModel.replace(/\bDUALLY\b.*$/i, '').replace(/\b2\.0\b/ig, '').trim())
    if (normalizeTaModel(rawModel).endsWith('B') && normalizeTaModel(rawModel).length > 1) {
      addCandidate(normalizeTaModel(rawModel).slice(0, -1))
    }

    return candidates
  }

  const selectAssetsForWheel = (rawModel) => {
    const needsDually = /\bDUALLY\b/i.test(rawModel)
    const matchedAssets = buildWheelCandidates(rawModel)
      .flatMap(candidate => taMapping[candidate] || [])
      .filter((asset, index, arr) => arr.findIndex(item => item.fullUrl === asset.fullUrl && item.type === asset.type) === index)
      .filter(asset => needsDually ? true : asset.isDually !== true)

    return finalizeAssets(matchedAssets)
  }

  const taUpdateByModel = db.prepare('UPDATE wheels SET ta_image_url = ?, ta_images_json = ? WHERE UPPER(model) = ?')
  const taUpdateById = db.prepare('UPDATE wheels SET ta_image_url = ?, ta_images_json = ? WHERE id = ?')
  let taUpdated = 0

  const taTxn = db.transaction(() => {
    for (const [model, assets] of Object.entries(taMapping)) {
      const selectedAssets = finalizeAssets(assets)
      if (!selectedAssets.length) continue
      taUpdated += taUpdateByModel.run(selectedAssets[0].url, JSON.stringify(selectedAssets), model).changes
    }

    const wheels = db.prepare('SELECT id, model FROM wheels').all()
    for (const wheel of wheels) {
      const rawModel = String(wheel.model || '').trim()
      if (!rawModel) continue

      const selectedAssets = selectAssetsForWheel(rawModel)
      if (!selectedAssets.length) continue

      taUpdated += taUpdateById.run(selectedAssets[0].url, JSON.stringify(selectedAssets), wheel.id).changes
    }
  })
  taTxn()
  console.log(`  Mapped ${Object.keys(taMapping).length} models, updated ${taUpdated} wheels`)
} catch (e) {
  console.log('  ⚠️  ToughAssets image import failed:', e.message)
}

db.close()
console.log('\n✅ Import complete!')
