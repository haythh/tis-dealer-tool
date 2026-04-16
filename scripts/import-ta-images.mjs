#!/usr/bin/env node
/**
 * Import ToughAssets wheel images into the dealer tool DB.
 * Maps model numbers to ToughAssets CDN thumbnail URLs.
 */
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'dealer-tool.db');

const TA_BASE = 'https://toughassets.com/api/public/tis/assets';

async function main() {
  console.log('🖼️  Importing ToughAssets wheel images...');
  
  // Fetch all ToughAssets wheel images
  const res = await fetch(TA_BASE);
  const data = await res.json();
  const assets = (data.assets || data).filter(a => 
    a.categoryName === 'Wheels' || a.categoryName === 'Products'
  );
  
  // Build model -> full-res image URL mapping
  // Use the file endpoint for full res, not thumbnails
  const mapping = {};
  for (const a of assets) {
    const name = a.originalName.replace(/\.(png|jpg|webp|jpeg)$/i, '');
    const model = name.split(/[-.\s]/)[0].toUpperCase();
    // Prefer CDN thumb for faster loading, fall back to file endpoint
    const url = a.thumbUrl || `https://toughassets.com/api/file/${a.id}`;
    if (!mapping[model]) {
      mapping[model] = url;
    }
  }
  
  console.log(`  Found ${Object.keys(mapping).length} model -> image mappings from ToughAssets`);
  
  const db = new Database(DB_PATH);
  
  // Add ta_image_url column if needed
  try { db.exec("ALTER TABLE wheels ADD COLUMN ta_image_url TEXT"); } catch {}
  
  const update = db.prepare("UPDATE wheels SET ta_image_url = ? WHERE UPPER(model) = ?");
  let updated = 0;
  
  const txn = db.transaction(() => {
    for (const [model, url] of Object.entries(mapping)) {
      const result = update.run(url, model);
      updated += result.changes;
    }
  });
  txn();
  
  const hasImg = db.prepare("SELECT COUNT(*) as c FROM wheels WHERE ta_image_url IS NOT NULL").get().c;
  console.log(`  Updated: ${updated} wheel records`);
  console.log(`  Wheels with ToughAssets image: ${hasImg}`);
  
  db.close();
}

main().catch(e => { console.error(e); process.exit(1); });
