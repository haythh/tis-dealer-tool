import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  
  await context.addCookies([
    { name: 'GSIDS5j46rUijNdM', value: '16af114b-7276-4288-b16c-14b7df34111b', domain: '.atdonline.com', path: '/' },
    { name: 'STSID141647', value: '4c07166b-db8b-46ef-9508-fdfacd375458', domain: '.atdonline.com', path: '/' },
    { name: 'userId', value: '338828', domain: '.atdonline.com', path: '/' },
  ]);
  
  const page = await context.newPage();
  console.log('Loading page...');
  await page.goto('https://atdonline.com/p/A281237/detailPage', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  const text = await page.textContent('body');
  
  // Prices
  const prices = text.match(/\$[\d,]+\.?\d*/g);
  console.log('Prices found:', prices);
  
  // Stock
  const lower = text.toLowerCase();
  for (const w of ['in stock', 'out of stock', 'available', 'unavailable', 'backorder', 'warehouse', 'qty', 'quantity']) {
    const idx = lower.indexOf(w);
    if (idx >= 0) {
      console.log(`Found "${w}": ...${text.substring(Math.max(0, idx - 40), idx + 50).trim()}...`);
    }
  }
  
  await page.screenshot({ path: '/tmp/atd-product-page.png', fullPage: false });
  console.log('Screenshot: /tmp/atd-product-page.png');
  
  await browser.close();
}
test();
