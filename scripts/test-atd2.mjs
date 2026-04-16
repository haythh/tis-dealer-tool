import { chromium } from 'playwright';

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

async function test() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(COOKIES);
  
  const page = await context.newPage();
  console.log('Loading product page...');
  await page.goto('https://atdonline.com/p/A281237/detailPage', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);
  
  const text = await page.textContent('body');
  
  // Prices
  const prices = text.match(/\$[\d,]+\.?\d*/g);
  console.log('Prices found:', prices);
  
  // Stock keywords
  const lower = text.toLowerCase();
  for (const w of ['in stock', 'out of stock', 'available', 'unavailable', 'backorder', 'warehouse', 'qty', 'quantity', 'add to cart', 'add to order']) {
    const idx = lower.indexOf(w);
    if (idx >= 0) {
      console.log(`"${w}": ...${text.substring(Math.max(0, idx - 40), idx + 60).trim()}...`);
    }
  }
  
  // Images
  const images = await page.$$eval('img', imgs => imgs.map(i => ({ src: i.src, alt: i.alt })).filter(i => i.src && !i.src.includes('data:') && (i.alt || i.src.includes('product') || i.src.includes('wheel'))));
  console.log('Product images:', images.slice(0, 5));
  
  await page.screenshot({ path: '/Users/haythemhaddad/.openclaw/workspace/atd-screenshot2.png', fullPage: false });
  console.log('Screenshot saved');
  
  await browser.close();
}
test();
