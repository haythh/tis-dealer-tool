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
  
  // Build model -> image URL mapping, preferring the first non-brand tag.
  // Fall back to filename parsing when tags are missing or unusable.
  const normalizeModel = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const extractModelCandidates = (asset) => {
    const candidates = [];
    const addCandidate = (value) => {
      const cleaned = normalizeModel(value);
      if (cleaned && !candidates.includes(cleaned)) candidates.push(cleaned);
    };

    const primaryTag = (Array.isArray(asset?.tags) ? asset.tags : [])
      .find(tag => String(tag || '').trim() && !String(tag).toLowerCase().startsWith('brand:'));
    if (primaryTag) addCandidate(primaryTag);

    const name = String(asset?.originalName || '').replace(/\.(png|jpg|webp|jpeg)$/i, '').trim();
    if (name) {
      const normalized = name
        .replace(/^dts[-_\s]*/i, '')
        .replace(/^tis[-_\s]*/i, '')
        .trim();
      const leadingModelMatch = normalized.match(/^([0-9]+[A-Z0-9]*)/i);
      if (leadingModelMatch) addCandidate(leadingModelMatch[1]);
      addCandidate(normalized.split(/[-.\s]/)[0]);
      addCandidate(name.split(/[-.\s]/)[0]);
    }

    return candidates;
  };

  const mapping = {};
  for (const a of assets) {
    const url = a.thumbUrl || `https://toughassets.com/api/file/${a.id}`;
    for (const model of extractModelCandidates(a)) {
      if (!mapping[model]) {
        mapping[model] = url;
      }
    }
  }
  
  console.log(`  Found ${Object.keys(mapping).length} model -> image mappings from ToughAssets`);
  
  const db = new Database(DB_PATH);
  
  // Add ta_image_url column if needed
  try { db.exec("ALTER TABLE wheels ADD COLUMN ta_image_url TEXT"); } catch {}
  
  const updateByModel = db.prepare("UPDATE wheels SET ta_image_url = ? WHERE UPPER(model) = ?");
  const updateById = db.prepare("UPDATE wheels SET ta_image_url = ? WHERE id = ?");
  let updated = 0;
  
  const txn = db.transaction(() => {
    for (const [model, url] of Object.entries(mapping)) {
      const result = updateByModel.run(url, model);
      updated += result.changes;
    }

    const wheels = db.prepare("SELECT id, model FROM wheels WHERE ta_image_url IS NULL").all();
    for (const wheel of wheels) {
      const rawModel = String(wheel.model || '').trim();
      if (!rawModel) continue;

      const candidates = [];
      const addCandidate = (value) => {
        const cleaned = normalizeModel(value);
        if (cleaned && !candidates.includes(cleaned)) candidates.push(cleaned);
      };

      addCandidate(rawModel);
      addCandidate(rawModel.split(/[-.\s]/)[0]);
      addCandidate(rawModel.replace(/\bDUALLY\b.*$/i, '').trim());
      addCandidate(rawModel.replace(/\b2\.0\b/ig, '').trim());
      addCandidate(rawModel.replace(/\bDUALLY\b.*$/i, '').replace(/\b2\.0\b/ig, '').trim());
      if (normalizeModel(rawModel).endsWith('B') && normalizeModel(rawModel).length > 1) {
        addCandidate(normalizeModel(rawModel).slice(0, -1));
      }

      const matchedUrl = candidates.map(candidate => mapping[candidate]).find(Boolean);
      if (!matchedUrl) continue;

      const result = updateById.run(matchedUrl, wheel.id);
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
