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
// PARSE XLSX FILES
// ============================================================
console.log('📄 Reading masterlist...')
const masterlistPath = join(ROOT, 'tis-masterlist.xlsx')
const masterlistWb = XLSX.readFile(masterlistPath)
const masterlistSheet = masterlistWb.Sheets[masterlistWb.SheetNames[0]]

// Get raw array of arrays (row 3 = headers at index 2, data starts row 4 at index 3)
const masterlistRaw = XLSX.utils.sheet_to_json(masterlistSheet, { header: 1, defval: '' })
console.log(`  Total rows in masterlist: ${masterlistRaw.length}`)
console.log(`  Header row (row 3):`, masterlistRaw[2]?.slice(0, 12))

// Data starts at index 3 (row 4)
const masterlistData = masterlistRaw.slice(3).filter(row => row[0]) // filter empty rows

console.log(`  Data rows: ${masterlistData.length}`)
console.log(`  Sample row 1:`, masterlistData[0]?.slice(0, 12))

console.log('\n📄 Reading MAP pricing...')
const mapPath = join(ROOT, 'tis-map-pricing.xlsx')
const mapWb = XLSX.readFile(mapPath)
const mapSheet = mapWb.Sheets[mapWb.SheetNames[0]]
const mapRaw = XLSX.utils.sheet_to_json(mapSheet, { header: 1, defval: '' })

// Row 1 = headers at index 0
const mapHeaders = mapRaw[0]
console.log(`  Headers:`, mapHeaders)
const mapData = mapRaw.slice(1).filter(row => row[0])
console.log(`  Data rows: ${mapData.length}`)

// Find column indices in MAP pricing
const oracleIdx = mapHeaders.findIndex(h => String(h).toUpperCase().includes('ORACLE'))
const supplierIdx = mapHeaders.findIndex(h => String(h).toUpperCase().includes('SUPPLIER'))
const upcIdx = mapHeaders.findIndex(h => String(h).toUpperCase().includes('UPC'))
const mapPriceIdx = mapHeaders.findIndex(h => String(h).toUpperCase().includes('MAP') || String(h).toUpperCase().includes('PROPOSED'))
const sizeIdx = mapHeaders.findIndex(h => String(h).toUpperCase().includes('UNIT_SIZE') || String(h).toUpperCase().includes('SIZE'))

console.log(`  Column indices — oracle:${oracleIdx} supplier:${supplierIdx} upc:${upcIdx} mapPrice:${mapPriceIdx}`)

// Build UPC → MAP pricing lookup
const mapByUpc = new Map()
const mapBySupplier = new Map()

for (const row of mapData) {
  const oracle = String(row[oracleIdx] || '').trim()
  const supplier = String(row[supplierIdx] || '').trim()
  const upcRaw = String(row[upcIdx] || '').trim()
  const mapPrice = parseFloat(String(row[mapPriceIdx] || '').replace(/[^0-9.]/g, '')) || null

  if (upcRaw) {
    // Strip leading zeros for matching
    const upcNorm = upcRaw.replace(/^0+/, '')
    mapByUpc.set(upcNorm, { oracle, supplier, mapPrice })
  }
  if (supplier) {
    mapBySupplier.set(supplier.toLowerCase(), { oracle, supplier, mapPrice })
  }
}

console.log(`  MAP lookup by UPC: ${mapByUpc.size} entries`)
console.log(`  MAP lookup by supplier: ${mapBySupplier.size} entries`)

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
    lug_count INTEGER
  )
`)

db.exec(`CREATE INDEX IF NOT EXISTS idx_wheels_bolt ON wheels(bolt_pattern)`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_wheels_model ON wheels(model)`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_wheels_size ON wheels(size)`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_wheels_upc ON wheels(upc)`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_vehicles_make ON vehicles(make)`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_vehicles_bolt ON vehicles(bolt_pattern)`)

// ============================================================
// INSERT WHEELS
// ============================================================
console.log('\n⚙️  Inserting wheel data...')

const insertWheel = db.prepare(`
  INSERT INTO wheels (supplier_pn, oracle_id, brand, model, color_finish, size, offset_mm, bolt_pattern, hub_bore, placement, material, fitment_category, msrp, map_price, upc, image_url, atd_url)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

let inserted = 0
let matched = 0
let noAtd = 0

const insertMany = db.transaction((rows) => {
  for (const row of rows) {
    // Col indices (0-based): 
    // 0: Supplier P/N, 1: Brand, 2: Wheel Model, 3: Color/Finish, 4: Size
    // 5: Offset, 6: Bolt Pattern, 7: Hub Bore, 8: Placement, 9: Material
    // 10: Fitment, 11: MSRP, ... 17: UPC (col 18 = index 17), 20: Image URL (col 21 = index 20)
    const supplierPn = String(row[0] || '').trim()
    const brand = String(row[1] || 'TIS').trim()
    const model = String(row[2] || '').trim()
    const colorFinish = String(row[3] || '').trim()
    const size = String(row[4] || '').trim()
    const offsetMm = String(row[5] || '').trim()
    const boltPatternRaw = String(row[6] || '').trim()
    const boltPattern = normalizeBP(boltPatternRaw)
    const hubBore = String(row[7] || '').trim()
    const placement = String(row[8] || '').trim()
    const material = String(row[9] || '').trim()
    const fitmentCategory = String(row[10] || '').trim()
    const msrpRaw = parseFloat(String(row[11] || '').replace(/[^0-9.]/g, '')) || null
    const upcRaw = String(row[17] || '').trim()
    const imageUrl = String(row[20] || '').trim() || null

    // Try to find MAP pricing match
    const upcNorm = upcRaw.replace(/^0+/, '')
    let oracleId = null
    let mapPrice = null

    let mapEntry = mapByUpc.get(upcNorm)
    if (!mapEntry && upcRaw) {
      // Try with padded UPC (some have leading zeros stripped)
      for (const [key, val] of mapByUpc.entries()) {
        if (key === upcNorm || key.replace(/^0+/, '') === upcNorm) {
          mapEntry = val
          break
        }
      }
    }

    // Fallback: match by supplier part number
    if (!mapEntry && supplierPn) {
      mapEntry = mapBySupplier.get(supplierPn.toLowerCase())
    }

    if (mapEntry) {
      oracleId = mapEntry.oracle || null
      mapPrice = mapEntry.mapPrice
      matched++
    } else {
      noAtd++
    }

    const atdUrl = oracleId ? `https://atdonline.com/p/${oracleId}/detailPage` : null

    insertWheel.run(
      supplierPn, oracleId, brand, model, colorFinish, size, offsetMm,
      boltPattern, hubBore, placement, material, fitmentCategory,
      msrpRaw, mapPrice, upcRaw, imageUrl, atdUrl
    )
    inserted++
  }
})

insertMany(masterlistData)
console.log(`  ✅ Inserted: ${inserted} wheels`)
console.log(`  🔗 Matched to ATD: ${matched}`)
console.log(`  ⚠️  No ATD match: ${noAtd}`)

// ============================================================
// INSERT VEHICLES
// ============================================================
console.log('\n🚗 Inserting vehicle fitment data...')

const insertVehicle = db.prepare(`
  INSERT INTO vehicles (year_start, year_end, make, model, bolt_pattern, lug_count)
  VALUES (?, ?, ?, ?, ?, ?)
`)

const insertVehicles = db.transaction((vehicles) => {
  for (const v of vehicles) {
    insertVehicle.run(v.year_start, v.year_end, v.make, v.model, v.bolt_pattern, v.lug_count)
  }
})

insertVehicles(VEHICLES)
console.log(`  ✅ Inserted: ${VEHICLES.length} vehicle fitment records`)

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
  SELECT w.model, w.color_finish, w.bolt_pattern, w.size, w.map_price, w.atd_url
  FROM wheels w 
  WHERE w.atd_url IS NOT NULL
  LIMIT 3
`).all()

console.log('\n🔍 Sample wheels with ATD URLs:')
sample.forEach(w => {
  console.log(`  ${w.model} | ${w.color_finish} | ${w.bolt_pattern} | ${w.size} | $${w.map_price} | ${w.atd_url}`)
})

// --- FIX: supplier_pn that looks like oracle IDs (A-prefix) ---
const fixedOracles = db.prepare(`UPDATE wheels SET oracle_id = supplier_pn, atd_url = 'https://atdonline.com/p/' || supplier_pn || '/detailPage' WHERE supplier_pn LIKE 'A%' AND (oracle_id IS NULL OR oracle_id = '')`).run()
if (fixedOracles.changes > 0) console.log(`  Fixed ${fixedOracles.changes} wheels with A-prefix supplier_pn as oracle_id`)

// --- IMPORT STOCK DATA ---
console.log('\n📦 Importing ATD stock data...')
try {
  db.exec("ALTER TABLE wheels ADD COLUMN in_stock INTEGER DEFAULT 1")
} catch {}
try {
  db.exec("ALTER TABLE wheels ADD COLUMN stock_pickup INTEGER DEFAULT 0")
} catch {}
try {
  db.exec("ALTER TABLE wheels ADD COLUMN stock_today INTEGER DEFAULT 0")
} catch {}
try {
  db.exec("ALTER TABLE wheels ADD COLUMN stock_tomorrow INTEGER DEFAULT 0")
} catch {}
try {
  db.exec("ALTER TABLE wheels ADD COLUMN stock_national INTEGER DEFAULT 0")
} catch {}
try {
  db.exec("ALTER TABLE wheels ADD COLUMN total_stock INTEGER DEFAULT 0")
} catch {}
try {
  db.exec("ALTER TABLE wheels ADD COLUMN atd_image_url TEXT")
} catch {}
try {
  db.exec("ALTER TABLE wheels ADD COLUMN stock_updated_at TEXT")
} catch {}

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
  console.log('  ⚠️  No stock data file found — skipping stock import')
}

// --- IMPORT TOUGHASSETS IMAGES ---
console.log('\n🖼️  Importing ToughAssets images...')
try {
  db.exec("ALTER TABLE wheels ADD COLUMN ta_image_url TEXT")
} catch {}

try {
  const taRes = await fetch('https://toughassets.com/api/public/tis/assets')
  const taData = await taRes.json()
  const taAssets = (taData.assets || taData).filter(a => a.categoryName === 'Wheels' || a.categoryName === 'Products')
  const taMapping = {}
  for (const a of taAssets) {
    const name = a.originalName.replace(/\.(png|jpg|webp|jpeg)$/i, '')
    const model = name.split(/[-.\s]/)[0].toUpperCase()
    const url = a.thumbUrl || `https://toughassets.com/api/file/${a.id}`
    if (!taMapping[model]) taMapping[model] = url
  }
  const taUpdate = db.prepare('UPDATE wheels SET ta_image_url = ? WHERE UPPER(model) = ?')
  let taUpdated = 0
  const taTxn = db.transaction(() => {
    for (const [model, url] of Object.entries(taMapping)) {
      taUpdated += taUpdate.run(url, model).changes
    }
  })
  taTxn()
  console.log(`  Mapped ${Object.keys(taMapping).length} models, updated ${taUpdated} wheels`)
} catch (e) {
  console.log('  ⚠️  ToughAssets image import failed:', e.message)
}

db.close()
console.log('\n✅ Import complete!')
