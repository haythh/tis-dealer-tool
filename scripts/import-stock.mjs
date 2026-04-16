#!/usr/bin/env node
/**
 * Import ATD scrape results (stock + images) into the dealer tool DB.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'dealer-tool.db');
const SCRAPE_PATH = path.join(__dirname, '..', 'data', 'atd-scrape-results.json');

const db = new Database(DB_PATH);

// Add stock columns if they don't exist
try { db.exec("ALTER TABLE wheels ADD COLUMN in_stock INTEGER DEFAULT 1"); } catch {}
try { db.exec("ALTER TABLE wheels ADD COLUMN stock_pickup INTEGER DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE wheels ADD COLUMN stock_today INTEGER DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE wheels ADD COLUMN stock_tomorrow INTEGER DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE wheels ADD COLUMN stock_national INTEGER DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE wheels ADD COLUMN total_stock INTEGER DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE wheels ADD COLUMN atd_image_url TEXT"); } catch {}
try { db.exec("ALTER TABLE wheels ADD COLUMN stock_updated_at TEXT"); } catch {}

const scrapeData = JSON.parse(fs.readFileSync(SCRAPE_PATH, 'utf-8'));

const update = db.prepare(`
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
`);

let updated = 0;
let skipped = 0;

const txn = db.transaction(() => {
  for (const item of scrapeData) {
    const result = update.run(
      item.inStock ? 1 : 0,
      item.stockPickup || 0,
      item.stockToday || 0,
      item.stockTomorrow || 0,
      item.stockNational || 0,
      item.totalStock || 0,
      item.imageUrl || null,
      item.scrapedAt || new Date().toISOString(),
      item.oracleId
    );
    if (result.changes > 0) updated++;
    else skipped++;
  }
});

txn();

console.log(`✅ Stock import complete`);
console.log(`  Updated: ${updated}`);
console.log(`  Skipped (no matching oracle_id): ${skipped}`);
console.log(`  Total scrape records: ${scrapeData.length}`);

// Quick stats
const stats = db.prepare(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN in_stock = 1 THEN 1 ELSE 0 END) as in_stock,
    SUM(CASE WHEN in_stock = 0 THEN 1 ELSE 0 END) as out_of_stock,
    SUM(total_stock) as total_units,
    SUM(CASE WHEN atd_image_url IS NOT NULL THEN 1 ELSE 0 END) as has_image
  FROM wheels WHERE oracle_id IS NOT NULL AND oracle_id != ''
`).get();

console.log(`\nDB Stats:`);
console.log(`  In stock: ${stats.in_stock} | Out of stock: ${stats.out_of_stock}`);
console.log(`  Total units: ${stats.total_units}`);
console.log(`  With ATD image: ${stats.has_image}`);

db.close();
