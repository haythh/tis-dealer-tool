#!/usr/bin/env node
/**
 * ATDOnline tire mapper for TIS RT1 / TT1.
 *
 * Requires a fresh authenticated ATDOnline session cookie:
 *   ATD_COOKIE='name=value; name2=value2' npm run scrape-atd-tires
 *
 * Output updates src/data/tis-tires.json with:
 *   atdProductNumber, atdSupplierNumber, atdUrl, ATD price fields,
 *   stockPickup, stockToday, stockTomorrow, stockNational, totalStock, inStock,
 *   stockUpdatedAt, atdScrapedAt
 */

import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const TIRE_DATA_PATH = join(ROOT, 'src', 'data', 'tis-tires.json')
const BASE_URL = 'https://atdonline.com'
const COOKIE = process.env.ATD_COOKIE || ''

const TT1_ATD_PRODUCT_BY_SIZE = {
  '33X12.50R17/10': '98529.1',
  '35X12.50R17/10': '98530',
  '33X12.50R18/12': '98531',
  '35X12.50R18/12': '98534',
  '33X12.50R20/12': '98528',
  '33X14.50R20/12': '98533.1',
  '35X12.50R20/12': '98527',
  '35X14.50R20/12': '98537',
  '37X12.50R20/10': '98526',
  '37X13.50R20/12': '98532',
  '33X12.50R22/12': '98535',
  '33X14.50R22/12': '98541',
  '35X12.50R22/12': '98536',
  '37X13.50R22/12': '98538',
  '33X14.50R24/10': '98542',
  '35X15.50R24/10': '98544',
  '37X13.50R24/12': '98540',
  '35X13.50R26/10': '98543',
  '37X13.50R26/12': '98539',
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function delayMs() {
  return 1800 + Math.random() * 1200
}

function normalize(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function tireSearchTerms(tire) {
  const terms = new Set()
  if (tire.itemNo) terms.add(String(tire.itemNo))
  terms.add(`${tire.line} ${tire.size}`)
  terms.add(`${tire.name} ${tire.size}`)
  terms.add(tire.size)
  return [...terms].filter(term => term && term.length >= 4)
}

function flattenProductPayload(payload) {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload.products)) return payload.products
  if (payload.data) return flattenProductPayload(payload.data)
  if (typeof payload === 'object') return Object.values(payload).filter(value => value && typeof value === 'object')
  return []
}

function candidateText(product) {
  return [
    product.productNumber,
    product.code,
    product.supplierNumber,
    product.mfgpartNumber,
    product.description,
    product.displayableBrandAndStyle,
    product.name,
    product.style?.brand?.code,
    product.style?.code,
    ...Object.values(product.partNumberMap || {}),
  ].filter(Boolean).join(' ')
}

function scoreCandidate(tire, product) {
  const text = normalize(candidateText(product))
  const size = normalize(tire.size)
  const line = normalize(tire.line)
  const itemNo = normalize(tire.itemNo)
  let score = 0

  if (itemNo && text.includes(itemNo)) score += 100
  if (size && text.includes(size)) score += 40
  if (line && text.includes(line)) score += 20
  if (normalize(product.displayableBrandAndStyle || product.description || '').includes('HERCULES')) score += 10
  return score
}

function pickBestCandidate(tire, products) {
  return products
    .map(product => ({ product, score: scoreCandidate(tire, product) }))
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.product || null
}

function isLoginHtml(text) {
  const compact = String(text || '').replace(/\s+/g, ' ')
  return /<form[^>]+(?:login|logon|j_spring_security_check)/i.test(compact)
    || /Welcome[^<]{0,120}LOG IN/i.test(compact)
    || /name=["']?j_username/i.test(compact)
    || /id=["']?loginForm/i.test(compact)
}

function textFromHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\r/g, '\n')
}

function extractStockQuantity(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const beforeLabel = new RegExp(`(\\d+)\\s*(?:\\n|\\s)*${escaped}`, 'i').exec(text)
  if (beforeLabel) return Number.parseInt(beforeLabel[1], 10)

  const afterLabel = new RegExp(`${escaped}\\s*(?:\\n|\\s)*(\\d+)`, 'i').exec(text)
  if (afterLabel) return Number.parseInt(afterLabel[1], 10)

  return null
}

function extractStockFromHtml(html) {
  const text = textFromHtml(html)
  const stockPickup = extractStockQuantity(text, 'Pickup')
  const stockToday = extractStockQuantity(text, 'Today')
  const stockTomorrow = extractStockQuantity(text, 'Tomorrow')
  const stockNational = extractStockQuantity(text, 'National')
  const hasStockSignal = [stockPickup, stockToday, stockTomorrow, stockNational].some(value => value != null) || /Pickup|Today|Tomorrow|National/i.test(text)

  if (!hasStockSignal) {
    return {
      inStock: null,
      stockPickup: null,
      stockToday: null,
      stockTomorrow: null,
      stockNational: null,
      totalStock: null,
    }
  }

  const normalized = {
    stockPickup: stockPickup || 0,
    stockToday: stockToday || 0,
    stockTomorrow: stockTomorrow || 0,
    stockNational: stockNational || 0,
  }
  const totalStock = normalized.stockPickup + normalized.stockToday + normalized.stockTomorrow + normalized.stockNational

  return {
    ...normalized,
    totalStock,
    inStock: totalStock > 0,
  }
}

async function requestJson(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    redirect: 'manual',
    headers: {
      cookie: COOKIE,
      accept: 'application/json, text/javascript, */*; q=0.01',
      'x-requested-with': 'XMLHttpRequest',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      referer: `${BASE_URL}/`,
    },
  })

  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get('location') || ''
    if (location.includes('/login')) throw new Error('ATD_SESSION_EXPIRED')
    throw new Error(`ATD redirected to ${location || response.status}`)
  }

  const text = await response.text()
  if (response.status === 401 || response.status === 403 || isLoginHtml(text)) {
    throw new Error('ATD_SESSION_EXPIRED')
  }
  if (!response.ok) throw new Error(`ATD HTTP ${response.status}`)

  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`ATD returned non-JSON response: ${text.slice(0, 120).replace(/\s+/g, ' ')}`)
  }
}

async function requestDetailProduct(productNumber, tire) {
  const response = await fetch(`${BASE_URL}/p/${encodeURIComponent(productNumber)}/detailPage`, {
    redirect: 'manual',
    headers: {
      cookie: COOKIE,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      referer: `${BASE_URL}/`,
    },
  })

  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get('location') || ''
    if (location.includes('/login')) throw new Error('ATD_SESSION_EXPIRED')
    return null
  }
  if (!response.ok) return null

  const html = await response.text()
  if (isLoginHtml(html)) throw new Error('ATD_SESSION_EXPIRED')

  const stock = extractStockFromHtml(html)

  const title = (html.match(/<h1[^>]*>([^<]+)/i) || html.match(/<title[^>]*>([^<]+)/i) || [])[1]?.trim() || ''
  const titleText = normalize(title)
  const sizeText = normalize(tire.size.replace('LT/', '').replace(/LT$/i, ''))
  const lineText = normalize(tire.line)

  if (!titleText.includes(lineText) && !titleText.includes(sizeText.slice(0, Math.min(sizeText.length, 8)))) {
    return null
  }

  return {
    productNumber,
    code: productNumber,
    supplierNumber: productNumber,
    description: title,
    displayableBrandAndStyle: title,
    ...stock,
  }
}

async function lookupTire(tire) {
  const directProductNumber = tire.itemNo || TT1_ATD_PRODUCT_BY_SIZE[tire.size]
  if (directProductNumber) {
    const product = await requestDetailProduct(directProductNumber, tire)
    if (product) return { term: directProductNumber, endpoint: `/p/${directProductNumber}/detailPage`, product }
  }

  for (const term of tireSearchTerms(tire)) {
    const encoded = encodeURIComponent(term)
    const endpoints = [
      `/stockOrder/add/${encoded}`,
      `/stockOrder/addBulk?searchTerm=${encoded}`,
    ]

    for (const endpoint of endpoints) {
      let payload
      try {
        payload = await requestJson(endpoint)
      } catch (error) {
        if (/ATD HTTP 404/.test(error.message)) continue
        throw error
      }
      const products = flattenProductPayload(payload)
      const best = pickBestCandidate(tire, products)
      if (best) return { term, endpoint, product: best }
    }
  }

  return null
}

function applyAtdMatch(tire, match) {
  if (!match?.product) return { ...tire, atdLookupStatus: 'not_found' }

  const product = match.product
  const productNumber = product.productNumber || product.code
  const supplierNumber = product.supplierNumber || product.mfgpartNumber || Object.values(product.partNumberMap || {})[0] || null

  return {
    ...tire,
    atdProductNumber: productNumber || null,
    atdSupplierNumber: supplierNumber,
    atdUrl: productNumber ? `${BASE_URL}/p/${encodeURIComponent(productNumber)}/detailPage` : null,
    atdProductName: product.displayableBrandAndStyle || product.description || product.name || tire.atdProductName || null,
    atdNetPrice: product.netPrice ?? product.netPriceLocalized?.value ?? tire.atdNetPrice ?? null,
    atdRetailPrice: product.retailPrice ?? product.retailPriceLocalized?.value ?? tire.atdRetailPrice ?? null,
    inStock: product.inStock ?? null,
    stockPickup: product.stockPickup ?? null,
    stockToday: product.stockToday ?? null,
    stockTomorrow: product.stockTomorrow ?? null,
    stockNational: product.stockNational ?? null,
    totalStock: product.totalStock ?? null,
    stockUpdatedAt: product.totalStock != null ? new Date().toISOString() : tire.stockUpdatedAt || null,
    atdLookupTerm: match.term,
    atdLookupStatus: productNumber ? 'found' : 'found_without_product_number',
    atdScrapedAt: new Date().toISOString(),
  }
}

async function main() {
  if (!COOKIE) {
    console.error('Missing ATD_COOKIE. Log into ATDOnline, copy the Cookie header, then run:')
    console.error("  ATD_COOKIE='name=value; name2=value2' npm run scrape-atd-tires")
    process.exit(2)
  }

  const data = JSON.parse(readFileSync(TIRE_DATA_PATH, 'utf8'))
  const updated = []
  let found = 0
  let missing = 0

  console.log(`🔍 ATDOnline tire scrape: ${data.tires.length} tires`)

  for (let index = 0; index < data.tires.length; index++) {
    const tire = data.tires[index]
    process.stdout.write(`[${index + 1}/${data.tires.length}] ${tire.line} ${tire.size}${tire.itemNo ? ` (${tire.itemNo})` : ''} ... `)

    const match = await lookupTire(tire)
    const enriched = applyAtdMatch(tire, match)
    updated.push(enriched)

    if (enriched.atdUrl) {
      found++
      console.log(`✅ ${enriched.atdProductNumber}`)
    } else {
      missing++
      console.log('— not found')
    }

    if ((index + 1) % 5 === 0) {
      writeFileSync(TIRE_DATA_PATH, `${JSON.stringify({ ...data, tires: updated.concat(data.tires.slice(index + 1)), counts: { ...data.counts, atdFound: found, atdMissing: missing }, atdScrapedAt: new Date().toISOString() }, null, 2)}\n`)
    }

    await sleep(delayMs())
  }

  const output = {
    ...data,
    counts: { ...data.counts, atdFound: found, atdMissing: missing },
    atdScrapedAt: new Date().toISOString(),
    tires: updated,
  }
  writeFileSync(TIRE_DATA_PATH, `${JSON.stringify(output, null, 2)}\n`)
  console.log(`\nDone. ATD links found: ${found}; missing: ${missing}`)
}

main().catch(error => {
  if (error.message === 'ATD_SESSION_EXPIRED') {
    console.error('ATD session expired or missing. Need a fresh ATDOnline Cookie header.')
    process.exit(3)
  }
  console.error(error)
  process.exit(1)
})
