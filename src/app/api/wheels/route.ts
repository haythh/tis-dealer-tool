import { NextRequest, NextResponse } from 'next/server'
import { getDb, normalizeBoltPattern, type Wheel } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const bolt_pattern = searchParams.get('bolt_pattern')
    const size = searchParams.get('size')
    const model = searchParams.get('model')
    const finish = searchParams.get('finish')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const offset = parseInt(searchParams.get('offset') || '0')

    const db = getDb()
    const conditions: string[] = []
    const params: (string | number)[] = []

    if (bolt_pattern) {
      const patterns = normalizeBoltPattern(bolt_pattern)
      conditions.push(`UPPER(bolt_pattern) IN (${patterns.map(p => `UPPER('${p.replace(/'/g, "''")}')`).join(',')})`)
    }
    if (size) {
      conditions.push('size LIKE ?')
      params.push(`%${size}%`)
    }
    if (model) {
      conditions.push('(model LIKE ? OR supplier_pn LIKE ?)')
      params.push(`%${model}%`, `%${model}%`)
    }
    if (finish) {
      conditions.push('LOWER(color_finish) LIKE LOWER(?)')
      params.push(`%${finish}%`)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const wheels = db.prepare(`SELECT * FROM wheels ${where} ORDER BY model, size LIMIT ? OFFSET ?`).all(...params, limit, offset) as Wheel[]
    const total = (db.prepare(`SELECT COUNT(*) as count FROM wheels ${where}`).get(...params) as { count: number }).count

    return NextResponse.json({ wheels, total, limit, offset })
  } catch (error) {
    console.error('Wheels API error:', error)
    return NextResponse.json({ error: 'Failed to fetch wheels' }, { status: 500 })
  }
}
