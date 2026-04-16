#!/usr/bin/env node
/**
 * ATDOnline Product Scraper
 * Run locally with your ATD session cookie.
 * Gently scrapes TIS product pages for price, stock, and images.
 * 
 * Usage: node scripts/scrape-atd.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'dealer-tool.db');
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'atd-scrape-results.json');
const PROGRESS_PATH = path.join(__dirname, '.atd-scrape-progress.json');

// ATD session cookie
const ATD_COOKIE = 'mt.v=2.1831879488.1776284169790; _ga=GA1.1.354328581.1776284170; GSIDS5j46rUijNdM=16af114b-7276-4288-b16c-14b7df34111b; STSID141647=4c07166b-db8b-46ef-9508-fdfacd375458; userId=338828; atdonline_391816_338828_program_status_selection=26HERCOPEN; kampyle_userid=2eb6-96f4-b7d3-2f7e-95b3-d495-48e9-8b8f; kampyleUserSession=1776284200113; kampyleUserSessionsCount=1; kampyleUserPercentile=11.127489141563762; RT="z=1&dm=atdonline.com&si=ml5tzkc79wk&ss=mo0hqd59&sl=0&tt=0"; kampyleSessionPageCounter=7; ltkpopup-session-depth=6-11; _ga_79VG9VDSTF=GS2.1.s1776284169$o1$g1$t1776285597$j58$l0$h0';

// Rate limiting: 1 request per 3-5 seconds (randomized)
function randomDelay() {
  return 3000 + Math.random() * 2000; // 3-5 seconds
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Load progress
function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf-8'));
  } catch {
    return { scraped: {} };
  }
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2));
}

// Get all oracle IDs from the database
async function getOracleIds() {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(DB_PATH);
  const rows = db.prepare(`
    SELECT DISTINCT oracle_id, supplier_pn, model, color_finish, size
    FROM wheels 
    WHERE oracle_id IS NOT NULL AND oracle_id != ''
    ORDER BY model, size
  `).all();
  db.close();
  return rows;
}

// Scrape a single ATD product page
async function scrapeProduct(oracleId) {
  const url = `https://atdonline.com/p/${oracleId}/detailPage`;
  
  const headers = {
    'Cookie': ATD_COOKIE,
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://atdonline.com/',
    'Connection': 'keep-alive',
  };

  const res = await fetch(url, { headers, redirect: 'follow' });
  
  if (res.status === 401 || res.status === 403) {
    throw new Error('Session expired — log into ATDOnline and update the cookie');
  }
  
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${oracleId}`);
  }

  const html = await res.text();

  // Check if we got redirected to login
  if (html.includes('login') && html.includes('password') && html.length < 5000) {
    throw new Error('Session expired — redirected to login page');
  }

  // Extract data from the HTML
  const result = {
    oracleId,
    url,
    scrapedAt: new Date().toISOString(),
    price: null,
    dealerPrice: null,
    listPrice: null,
    inStock: null,
    stockQty: null,
    imageUrl: null,
    productName: null,
  };

  // Price extraction — look for common patterns
  // ATD typically shows dealer price, list price, etc.
  const pricePatterns = [
    /dealer\s*price[:\s]*\$?([\d,]+\.?\d*)/i,
    /your\s*price[:\s]*\$?([\d,]+\.?\d*)/i,
    /net\s*price[:\s]*\$?([\d,]+\.?\d*)/i,
    /price[:\s]*\$?([\d,]+\.?\d*)/i,
    /\$(\d{2,4}\.\d{2})/,
  ];
  
  for (const pattern of pricePatterns) {
    const match = html.match(pattern);
    if (match) {
      result.dealerPrice = parseFloat(match[1].replace(',', ''));
      break;
    }
  }

  // List/MSRP price
  const listMatch = html.match(/list\s*(?:price)?[:\s]*\$?([\d,]+\.?\d*)/i) || 
                     html.match(/msrp[:\s]*\$?([\d,]+\.?\d*)/i) ||
                     html.match(/retail[:\s]*\$?([\d,]+\.?\d*)/i);
  if (listMatch) {
    result.listPrice = parseFloat(listMatch[1].replace(',', ''));
  }

  // Stock status
  if (html.match(/in\s*stock/i) || html.match(/available/i) || html.match(/add\s*to\s*cart/i)) {
    result.inStock = true;
  } else if (html.match(/out\s*of\s*stock/i) || html.match(/unavailable/i) || html.match(/back\s*order/i)) {
    result.inStock = false;
  }

  // Stock quantity
  const qtyMatch = html.match(/(\d+)\s*(?:available|in\s*stock|units?\s*available)/i) ||
                    html.match(/qty[:\s]*(\d+)/i) ||
                    html.match(/quantity[:\s]*(\d+)/i);
  if (qtyMatch) {
    result.stockQty = parseInt(qtyMatch[1]);
  }

  // Product image
  const imgMatch = html.match(/product[_-]?image[^"]*"([^"]+)"/i) ||
                    html.match(/main[_-]?image[^"]*"([^"]+)"/i) ||
                    html.match(/img[^>]+src="(https?:\/\/[^"]*(?:product|wheel|tire)[^"]*)"/i) ||
                    html.match(/<img[^>]+class="[^"]*product[^"]*"[^>]+src="([^"]+)"/i);
  if (imgMatch) {
    result.imageUrl = imgMatch[1];
  }

  // Product name/title
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                     html.match(/product[_-]?name[^"]*"[^>]*>([^<]+)/i) ||
                     html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    result.productName = titleMatch[1].trim();
  }

  return result;
}

async function main() {
  console.log('🔍 ATDOnline Product Scraper');
  console.log('Rate: 1 request per 3-5 seconds\n');

  // Get products to scrape
  const products = await getOracleIds();
  console.log(`Found ${products.length} products with ATD Oracle IDs\n`);

  if (products.length === 0) {
    console.log('No products to scrape. Make sure the database has oracle_id values.');
    process.exit(1);
  }

  // Load progress
  const progress = loadProgress();
  const results = [];

  // Load existing results
  try {
    const existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
    if (Array.isArray(existing)) results.push(...existing);
  } catch {}

  let scraped = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const oracleId = product.oracle_id;

    // Skip already scraped
    if (progress.scraped[oracleId]) {
      skipped++;
      continue;
    }

    console.log(`[${i + 1}/${products.length}] ${product.model} ${product.color_finish} ${product.size} (${oracleId})...`);

    try {
      const result = await scrapeProduct(oracleId);
      results.push(result);
      progress.scraped[oracleId] = true;
      scraped++;

      const stockLabel = result.inStock === true ? '✅ In Stock' : result.inStock === false ? '❌ Out of Stock' : '❓ Unknown';
      const priceLabel = result.dealerPrice ? `$${result.dealerPrice}` : 'no price';
      console.log(`  → ${stockLabel} | ${priceLabel}`);

      // Save progress periodically
      if (scraped % 5 === 0) {
        saveProgress(progress);
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));
      }
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
      errors++;
      
      if (err.message.includes('Session expired')) {
        console.log('\n⚠️  Your ATD session has expired. Log into ATDOnline again and update the cookie in this script.');
        break;
      }
    }

    // Rate limit
    const delay = randomDelay();
    await sleep(delay);
  }

  // Final save
  saveProgress(progress);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));

  console.log(`\n✅ Done!`);
  console.log(`  Scraped: ${scraped}`);
  console.log(`  Skipped (already done): ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Results saved to: ${OUTPUT_PATH}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
