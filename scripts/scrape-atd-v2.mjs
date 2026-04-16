import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'dealer-tool.db');
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'atd-scrape-results.json');
const PROGRESS_PATH = path.join(__dirname, '.atd-scrape-v2-progress.json');

const COOKIES = [
  { name: 'JSESSIONID', value: 'DAB4B418640C31117D013C4525FCE25A.tcserver4', domain: '.atdonline.com', path: '/' },
  { name: 'ATD', value: '2074089644.20480.0000', domain: '.atdonline.com', path: '/' },
  { name: 'GSIDS5j46rUijNdM', value: '16af114b-7276-4288-b16c-14b7df34111b', domain: '.atdonline.com', path: '/' },
  { name: 'STSID141647', value: '4c07166b-db8b-46ef-9508-fdfacd375458', domain: '.atdonline.com', path: '/' },
  { name: 'acceleratorSecureGUID', value: '79f3e8a43b08e4a5fbb037ed8d039706f2bc5167', domain: '.atdonline.com', path: '/' },
  { name: 'sid', value: '69dff227d5e87c5558255ac1', domain: '.atdonline.com', path: '/' },
  { name: 'csrf', value: 'b3d78fc0-b11e-4c0f-8dc6-9e3d975fe843', domain: '.atdonline.com', path: '/' },
  { name: 'userId', value: '338828', domain: '.atdonline.com', path: '/' },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomDelay() { return 5000 + Math.random() * 5000; } // 5-10 sec for Playwright

function loadProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf-8')); } catch { return { scraped: {} }; }
}
function saveProgress(p) { fs.writeFileSync(PROGRESS_PATH, JSON.stringify(p, null, 2)); }

async function getOracleIds() {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(DB_PATH);
  const rows = db.prepare(`SELECT DISTINCT oracle_id, supplier_pn, model, color_finish, size FROM wheels WHERE oracle_id IS NOT NULL AND oracle_id != '' ORDER BY model, size`).all();
  db.close();
  return rows;
}

async function scrapePage(page, oracleId) {
  const url = `https://atdonline.com/p/${oracleId}/detailPage`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  const text = await page.textContent('body');
  
  // Check for login redirect
  if (text.includes('Welcome') && text.includes('LOG IN') && text.includes('Password')) {
    throw new Error('SESSION_EXPIRED');
  }
  
  const result = {
    oracleId,
    url,
    scrapedAt: new Date().toISOString(),
    imageUrl: null,
    stockPickup: 0,
    stockToday: 0,
    stockTomorrow: 0,
    stockNational: 0,
    totalStock: 0,
    inStock: false,
    productName: null,
  };
  
  // Extract product image (main image from ATD CDN)
  const images = await page.$$eval('img', imgs => 
    imgs.map(i => i.src).filter(s => s.includes('images.atdonline.com') && s.includes('250X250'))
  );
  if (images.length > 0) result.imageUrl = images[0];
  
  // Extract stock quantities from the inventory section
  // ATD shows: quantity | delivery method (Pickup, Today, Tomorrow, National)
  // Look for numeric values near these keywords
  const inventoryText = text;
  
  // Try to find stock numbers — they appear as numbers before delivery labels
  const pickupMatch = inventoryText.match(/(\d+)\s*(?:\n|\s)*Pickup/i);
  const todayMatch = inventoryText.match(/(\d+)\s*(?:\n|\s)*Today/i);
  const tomorrowMatch = inventoryText.match(/(\d+)\s*(?:\n|\s)*Tomorrow/i);
  const nationalMatch = inventoryText.match(/(\d+)\s*(?:\n|\s)*National/i);
  
  if (pickupMatch) result.stockPickup = parseInt(pickupMatch[1]);
  if (todayMatch) result.stockToday = parseInt(todayMatch[1]);
  if (tomorrowMatch) result.stockTomorrow = parseInt(tomorrowMatch[1]);
  if (nationalMatch) result.stockNational = parseInt(nationalMatch[1]);
  
  result.totalStock = result.stockPickup + result.stockToday + result.stockTomorrow + result.stockNational;
  result.inStock = result.totalStock > 0;
  
  // Product name from page title or heading
  const h1 = await page.$eval('h1', el => el?.textContent?.trim()).catch(() => null);
  result.productName = h1;
  
  return result;
}

async function main() {
  console.log('🔍 ATDOnline Scraper v2 (Playwright)');
  console.log('Rate: 1 page per 5-10 seconds\n');
  
  const products = await getOracleIds();
  console.log(`Found ${products.length} products\n`);
  
  const progress = loadProgress();
  const results = [];
  
  // Load existing results
  try { const existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8')); if (Array.isArray(existing)) results.push(...existing); } catch {}
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' });
  await context.addCookies(COOKIES);
  const page = await context.newPage();
  
  let scraped = 0, skipped = 0, errors = 0;
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const oracleId = product.oracle_id;
    
    if (progress.scraped[oracleId]) { skipped++; continue; }
    
    console.log(`[${i + 1}/${products.length}] ${product.model} ${product.color_finish} ${product.size} (${oracleId})...`);
    
    try {
      const result = await scrapePage(page, oracleId);
      results.push(result);
      progress.scraped[oracleId] = true;
      scraped++;
      
      const stockLabel = result.inStock ? `✅ ${result.totalStock} total (${result.stockTomorrow} tomorrow, ${result.stockNational} national)` : '❌ Out of Stock';
      console.log(`  → ${stockLabel}`);
      
      if (scraped % 5 === 0) {
        saveProgress(progress);
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));
      }
    } catch (err) {
      console.log(`  ❌ ${err.message}`);
      errors++;
      if (err.message === 'SESSION_EXPIRED') {
        console.log('\n⚠️  Session expired! Log into ATDOnline and update cookies in this script.');
        break;
      }
    }
    
    await sleep(randomDelay());
  }
  
  saveProgress(progress);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));
  await browser.close();
  
  console.log(`\n✅ Done! Scraped: ${scraped} | Skipped: ${skipped} | Errors: ${errors}`);
  console.log(`Results: ${OUTPUT_PATH}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
