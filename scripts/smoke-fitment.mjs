#!/usr/bin/env node
import assert from 'assert/strict'
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import path from 'path'
import ts from 'typescript'

const ROOT = path.resolve(import.meta.dirname, '..')
const require = createRequire(import.meta.url)

require.extensions['.ts'] = function loadTs(module, filename) {
  let source = readFileSync(filename, 'utf8')
  source = source.replace(/from ['"]@\//g, `from '${ROOT.replace(/'/g, "\\'")}/src/`)
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: filename,
  }).outputText
  module._compile(output, filename)
}

const queries = [
  '2022 Chevy 1500 20 black',
  '2022 Chevy Silverado 1500 20 black',
  '2022 Silverado 1500 20 black',
  '2022 Silverado 2500 20 black',
  '2022 Silverado',
  'Jeep Wrangler',
  'show wheels for Jeep Wrangler',
  'show 20 black wheels for Jeep Wrangler',
  'Jeep Gladiator',
  'Ford Ranger',
  '2022 Ford F150',
  '2022 Honda Accord 20 black',
  '2021 Toyota Camry 20',
  '2023 BMW X5 22',
  'show TIS wheels for 2022 Honda Accord',
]

const passengerQueries = new Set([
  '2022 Honda Accord 20 black',
  '2021 Toyota Camry 20',
  '2023 BMW X5 22',
])

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function assertApiInvariant(query, response) {
  assert.equal(response.error, undefined, `${query}: API returned error ${response.error}`)
  const parsed = response.query_parsed
  const vehicle = parsed?.vehicle
  const patterns = response.matched_bolt_patterns || []
  const brands = unique((response.wheels || []).map(w => w.brand))
  const wheelBolts = unique((response.wheels || []).map(w => w.bolt_pattern))
  const notice = response.notice || ''

  if (/Silverado$/.test(query)) {
    assert.equal(response.total, 0, `${query}: ambiguous Silverado should not return wheels`)
    assert.match(notice, /Which Silverado/i, `${query}: should ask for 1500/2500/3500`)
  }

  if (/Silverado 1500|Chevy 1500/.test(query)) {
    assert.equal(vehicle?.model, 'Silverado 1500', `${query}: should parse/canonicalize Silverado 1500`)
    assert.deepEqual(patterns, ['6x139.7'], `${query}: should match only 1500 6-lug fitment row`)
    assert.ok(!wheelBolts.some(bp => /^8/i.test(bp)), `${query}: returned 8-lug wheel bolt pattern`)
    assert.ok(response.total > 0, `${query}: expected confirmed wheels`)
  }

  if (/Silverado 2500/.test(query)) {
    assert.equal(vehicle?.model, 'Silverado 2500', `${query}: should parse Silverado 2500`)
    assert.deepEqual(patterns, ['8x180'], `${query}: should match only HD 8-lug fitment row`)
  }

  if (/Wrangler/.test(query)) {
    assert.equal(vehicle?.make, 'Jeep', `${query}: should parse Jeep`)
    assert.equal(vehicle?.model, 'Wrangler', `${query}: should parse Wrangler, not Ranger`)
    assert.ok(!/Ranger/i.test(notice), `${query}: notice mentions Ranger`)
    assert.deepEqual(patterns, ['5x127'], `${query}: should match Wrangler bolt pattern`)
  }

  if (query === 'Jeep Gladiator') assert.equal(vehicle?.model, 'Gladiator', `${query}: should parse Gladiator`)
  if (query === 'Ford Ranger') assert.equal(vehicle?.model, 'Ranger', `${query}: should parse Ranger`)
  if (query === '2022 Ford F150') assert.equal(vehicle?.model, 'F-150', `${query}: should parse F-150`)

  if (passengerQueries.has(query)) {
    assert.ok(response.total > 0, `${query}: expected passenger Motorsports matches`)
    assert.deepEqual(brands, ['TIS Motorsports'], `${query}: passenger fitment must only show TIS Motorsports`)
  }

  if (query === 'show TIS wheels for 2022 Honda Accord') {
    assert.equal(response.total, 0, `${query}: explicit TIS passenger request should block`)
    assert.match(notice, /limited to TIS Motorsports/i, `${query}: should explain Motorsports-only passenger rule`)
  }
}

async function runApi(baseUrl) {
  console.log(`\nAPI smoke: ${baseUrl}`)
  for (const query of queries) {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, inStockOnly: false }),
      signal: AbortSignal.timeout(10000),
    })
    assert.equal(res.status, 200, `${query}: expected HTTP 200, got ${res.status}`)
    const json = await res.json()
    assertApiInvariant(query, json)
    console.log(`  ✓ ${query} → ${json.total} (${json.fitment_status})`)
  }
}

function assertSmsInvariant(query, reply) {
  const text = reply.messages.join('\n')
  const vehicle = reply.state?.vehicle
  const brands = unique((reply.cards || []).map(card => card.brand))
  const bolts = unique((reply.cards || []).map(card => card.bolt_pattern))

  if (/Silverado$/.test(query)) assert.match(text, /Which Silverado/i, `${query}: SMS should clarify ambiguous Silverado`)
  if (/Silverado 1500|Chevy 1500/.test(query)) {
    assert.equal(vehicle?.model, 'Silverado 1500', `${query}: SMS should canonicalize Silverado 1500`)
    assert.ok(!bolts.some(bp => /^8/i.test(bp)), `${query}: SMS returned 8-lug for 1500`)
  }
  if (/Silverado 2500/.test(query)) assert.equal(vehicle?.model, 'Silverado 2500', `${query}: SMS should parse Silverado 2500`)
  if (/Wrangler/.test(query)) {
    assert.equal(vehicle?.model, 'Wrangler', `${query}: SMS should parse Wrangler, not Ranger`)
    assert.ok(!/Ranger/i.test(text), `${query}: SMS response mentions Ranger`)
  }
  if (passengerQueries.has(query)) assert.deepEqual(brands, ['TIS Motorsports'], `${query}: SMS passenger fitment must only show TIS Motorsports`)
  if (query === 'show TIS wheels for 2022 Honda Accord') assert.match(text, /limited to TIS Motorsports/i, `${query}: SMS should block explicit TIS passenger request`)
}

function runSms() {
  console.log('\nSMS smoke: direct handleSmsDemoMessage()')
  const { handleSmsDemoMessage } = require(path.join(ROOT, 'src/lib/sms-demo.ts'))
  for (const query of queries) {
    const reply = handleSmsDemoMessage(query, {}, { baseUrl: 'http://localhost:4455' })
    assertSmsInvariant(query, reply)
    console.log(`  ✓ ${query} → ${reply.cards?.length || 0} card preview(s)`)
  }
}

const baseArg = process.argv.find(arg => arg.startsWith('--base-url='))
const baseUrl = baseArg?.split('=')[1] || process.env.FITMENT_BASE_URL
const smsOnly = process.argv.includes('--sms-only')
const apiOnly = process.argv.includes('--api-only')

if (!apiOnly) runSms()
if (!smsOnly) {
  if (!baseUrl) {
    console.log('\nSkipping API smoke: set FITMENT_BASE_URL or pass --base-url=http://localhost:PORT')
  } else {
    await runApi(baseUrl)
  }
}

console.log('\nFitment smoke passed.')
