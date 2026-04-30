#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const DB_PATH = path.join(ROOT, 'data', 'dealer-tool.db')
const OUT_PATH = path.join(ROOT, 'src', 'data', 'official-wheel-videos.json')

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36'
const SITEMAPS = [
  'https://tiswheels.com/page-sitemap.xml',
  'https://www.dropstars.com/page-sitemap.xml',
]

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }

  return response.text()
}

function modelToCandidateCodes(model) {
  const compact = model.toUpperCase().replace(/[^A-Z0-9.]/g, '')
  const candidates = new Set([compact])

  candidates.add(compact.replace('2.0', '2'))
  candidates.add(compact.replace(/DUALLYINNER|DUALLY/g, ''))
  candidates.add(compact.replace(/DUALLYINNER|DUALLY/g, '').replace('2.0', '2'))

  const base = compact.match(/^(\d{3}[A-Z0-9]*)/)
  if (base) candidates.add(base[1])

  return [...candidates].filter(Boolean)
}

function pageSlugsForModel(brand, model) {
  const style = model.match(/^(\d{3})/)?.[1]
  if (!style) return []

  const base = brand === 'DTS' ? 'https://www.dropstars.com' : 'https://tiswheels.com'
  const slugs = new Set([style, `${style}-2`])

  // Newer TIS 2.0 styles have dedicated pages with finish code in the slug.
  if (/\b2\.0\b/i.test(model)) {
    const finishCode = modelToCandidateCodes(model).find(code => code.endsWith('2'))
    if (finishCode) slugs.add(finishCode.toLowerCase())
  }

  // Special edition page linked from the 544 family.
  if (model.toUpperCase().startsWith('544RB')) slugs.add('544rb')

  return [...slugs].map(slug => `${base}/${slug}/`)
}

function inferVideoCode(videoUrl) {
  const decoded = decodeURIComponent(videoUrl.split('?')[0])
  const fileName = decoded.split('/').pop() || ''
  let stem = fileName.replace(/\.(mp4|mov|m4v|webm)$/i, '').toUpperCase()

  // Source typo: dts608mbs-webvid.mp4 is the 608MSB finish in ATD/catalog data.
  stem = stem.replace('608MBS', '608MSB')

  const embeddedCode = stem.match(/(?:DTS[-_]?)?(\d{3}[A-Z0-9]{0,5})/)
  if (embeddedCode) return embeddedCode[1]

  const tireCode = stem.match(/\b(RT1|TT1|UT1)\b/)
  if (tireCode) return tireCode[1]

  return null
}

function extractVideoUrls(html) {
  return [...new Set(
    [...html.matchAll(/https?:\\?\/\\?\/[^"'<> )]+?\.(?:mp4|mov|m4v|webm)(?:\?[^"'<> )]*)?/gi)]
      .map(match => match[0].replaceAll('\\/', '/'))
  )]
}

async function main() {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`Database not found at ${DB_PATH}. Run npm run import-data first.`)
  }

  const db = new Database(DB_PATH, { readonly: true })
  const wheelModels = db
    .prepare("SELECT DISTINCT brand, model FROM wheels WHERE brand IN ('TIS', 'TIS Motorsports', 'DTS') ORDER BY brand, model")
    .all()

  const targetCodes = new Map()
  for (const { brand, model } of wheelModels) {
    for (const code of modelToCandidateCodes(model)) {
      if (!targetCodes.has(code)) targetCodes.set(code, [])
      targetCodes.get(code).push({ brand, model })
    }
  }

  const pageUrls = new Set()
  for (const sitemapUrl of SITEMAPS) {
    try {
      const sitemap = await fetchText(sitemapUrl)
      for (const match of sitemap.matchAll(/<loc>(.*?)<\/loc>/g)) {
        pageUrls.add(match[1])
      }
    } catch (error) {
      console.warn(`Could not read sitemap ${sitemapUrl}: ${error.message}`)
    }
  }

  for (const { brand, model } of wheelModels) {
    for (const url of pageSlugsForModel(brand, model)) pageUrls.add(url)
  }

  const videosByCode = {}
  const failures = []

  for (const pageUrl of [...pageUrls].sort()) {
    const isWheelPage = /\/(\d{3}(?:-2)?|\d{3}[a-z]+2|544rb)\/?$/i.test(pageUrl)
    if (!isWheelPage) continue

    try {
      const html = await fetchText(pageUrl)
      const videoUrls = extractVideoUrls(html)
      for (const videoUrl of videoUrls) {
        const code = inferVideoCode(videoUrl)
        if (!code || !targetCodes.has(code)) continue
        if (videosByCode[code]?.videoUrl === videoUrl) continue

        const firstTarget = targetCodes.get(code)[0]
        videosByCode[code] = {
          code,
          brand: firstTarget.brand,
          models: [...new Set(targetCodes.get(code).map(item => item.model))],
          videoUrl: videoUrl.replace(/^http:\/\//i, 'https://'),
          pageUrl,
          sourceSite: pageUrl.includes('dropstars.com') ? 'dropstars.com' : 'tiswheels.com',
        }
      }
    } catch (error) {
      failures.push({ pageUrl, error: error.message })
    }

    await sleep(120)
  }

  const matchedModels = new Set()
  for (const entry of Object.values(videosByCode)) {
    for (const model of entry.models) matchedModels.add(`${entry.brand}:${model}`)
  }

  const missing = wheelModels
    .filter(({ brand, model }) => !matchedModels.has(`${brand}:${model}`))
    .map(({ brand, model }) => ({ brand, model, candidates: modelToCandidateCodes(model) }))

  const output = {
    generatedAt: new Date().toISOString(),
    sources: ['https://tiswheels.com', 'https://www.dropstars.com'],
    totalVideos: Object.keys(videosByCode).length,
    totalWheelModels: wheelModels.length,
    matchedWheelModels: wheelModels.length - missing.length,
    missing,
    failures,
    videosByCode: Object.fromEntries(Object.entries(videosByCode).sort(([a], [b]) => a.localeCompare(b))),
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(output, null, 2)}\n`)

  console.log(`Wrote ${OUT_PATH}`)
  console.log(`Official videos: ${output.totalVideos}`)
  console.log(`Matched wheel models: ${output.matchedWheelModels}/${output.totalWheelModels}`)
  if (missing.length) {
    console.log('Missing official videos:')
    for (const item of missing) console.log(`- ${item.brand} ${item.model}`)
  }
  if (failures.length) {
    console.log(`Fetch failures: ${failures.length}`)
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
