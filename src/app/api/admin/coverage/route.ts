import { NextResponse } from 'next/server'
import { getCoverageReport } from '@/lib/admin-coverage'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const report = await getCoverageReport()
    return NextResponse.json(report)
  } catch (error) {
    console.error('Admin coverage API error:', error)
    return NextResponse.json({ error: 'Failed to build coverage report' }, { status: 500 })
  }
}
