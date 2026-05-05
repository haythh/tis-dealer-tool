import { NextResponse } from 'next/server'
import { preorderOffroadWheels } from '@/data/preorder-offroad-wheels'
import { preorderWheels } from '@/data/preorder-wheels'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_WHEEL_CODES = new Set([...preorderWheels, ...preorderOffroadWheels].map(wheel => wheel.code))
const VALID_WHEEL_CODES_LIST = [...VALID_WHEEL_CODES]

type CountRow = {
  wheel_code: string
  count: number
}

function ensureUpvoteTable() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS preorder_upvotes (
      wheel_code TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

function cleanWheelCode(value: unknown) {
  return typeof value === 'string' ? value.trim().toUpperCase() : ''
}

function countsFor(codes: string[]) {
  ensureUpvoteTable()

  const counts = Object.fromEntries(codes.map(code => [code, 0])) as Record<string, number>
  if (!codes.length) return counts

  const placeholders = codes.map(() => '?').join(', ')
  const rows = getDb()
    .prepare(`SELECT wheel_code, count FROM preorder_upvotes WHERE wheel_code IN (${placeholders})`)
    .all(...codes) as CountRow[]

  for (const row of rows) {
    counts[row.wheel_code] = row.count
  }

  return counts
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const requestedCodes = url.searchParams
    .getAll('code')
    .flatMap(value => value.split(','))
    .map(cleanWheelCode)
    .filter(Boolean)

  const codes = requestedCodes.length ? requestedCodes : VALID_WHEEL_CODES_LIST
  const invalidCode = codes.find(code => !VALID_WHEEL_CODES.has(code))

  if (invalidCode) {
    return NextResponse.json({ error: `Invalid preorder wheel code: ${invalidCode}` }, { status: 400 })
  }

  return NextResponse.json({ counts: countsFor(codes) })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { wheelCode?: unknown } | null
  const wheelCode = cleanWheelCode(body?.wheelCode)

  if (!VALID_WHEEL_CODES.has(wheelCode)) {
    return NextResponse.json({ error: 'Invalid preorder wheel code.' }, { status: 400 })
  }

  ensureUpvoteTable()

  const row = getDb()
    .prepare(`
      INSERT INTO preorder_upvotes (wheel_code, count, updated_at)
      VALUES (?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(wheel_code) DO UPDATE SET
        count = count + 1,
        updated_at = CURRENT_TIMESTAMP
      RETURNING count
    `)
    .get(wheelCode) as { count: number }

  return NextResponse.json({ wheelCode, count: row.count })
}
