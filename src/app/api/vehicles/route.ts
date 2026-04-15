import { NextRequest, NextResponse } from 'next/server'
import { getDb, type Vehicle } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const make = searchParams.get('make')
    const model = searchParams.get('model')
    const year = searchParams.get('year')

    const db = getDb()
    const conditions: string[] = []
    const params: (string | number)[] = []

    if (make) {
      conditions.push('LOWER(make) LIKE LOWER(?)')
      params.push(`%${make}%`)
    }
    if (model) {
      conditions.push('LOWER(model) LIKE LOWER(?)')
      params.push(`%${model}%`)
    }
    if (year) {
      const y = parseInt(year)
      conditions.push('year_start <= ? AND year_end >= ?')
      params.push(y, y)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const vehicles = db.prepare(`SELECT * FROM vehicles ${where} ORDER BY make, model, year_start`).all(...params) as Vehicle[]

    return NextResponse.json({ vehicles, total: vehicles.length })
  } catch (error) {
    console.error('Vehicles API error:', error)
    return NextResponse.json({ error: 'Failed to fetch vehicles' }, { status: 500 })
  }
}
