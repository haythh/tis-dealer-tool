'use client'

import { useEffect, useMemo, useState } from 'react'

type CoverageModelRow = {
  model: string
  brand: string
  sizesInCatalog: string[]
  imageCount: number
  hasFace: boolean
  hasAngle: boolean
  hasTopAngle: boolean
  hasVideo: boolean
  sizeTags: string[]
  missingSizes: string[]
  status: 'Complete' | 'Partial' | 'Missing'
}

type CoverageResponse = {
  summary: {
    totalWheelSkus: number
    skusWithToughAssetsImages: number
    skusMissingToughAssetsImages: number
    totalToughAssetsImagesAvailable: number
    modelsWithVideo: number
  }
  models: CoverageModelRow[]
  missing: CoverageModelRow[]
  generatedAt: string
  error?: string
}

const AUTH_COOKIE = 'tis_admin_auth'
const AUTH_PASSWORD = 'tough2026'

const statCards = [
  { key: 'totalWheelSkus', label: 'Total wheel SKUs in DB' },
  { key: 'skusWithToughAssetsImages', label: 'SKUs with ToughAssets images' },
  { key: 'skusMissingToughAssetsImages', label: 'SKUs missing ToughAssets images' },
  { key: 'totalToughAssetsImagesAvailable', label: 'Total ToughAssets images available' },
  { key: 'modelsWithVideo', label: 'Models with video' },
] as const

function setAuthCookie() {
  document.cookie = `${AUTH_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`
}

function hasAuthCookie() {
  return document.cookie.split('; ').some(cookie => cookie.startsWith(`${AUTH_COOKIE}=`))
}

function Badge({ ok }: { ok: boolean }) {
  return <span style={{ color: ok ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{ok ? '✓' : '✗'}</span>
}

function StatusPill({ status }: { status: CoverageModelRow['status'] }) {
  const colors = {
    Complete: { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.35)', text: '#86efac' },
    Partial: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.35)', text: '#fcd34d' },
    Missing: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.35)', text: '#fca5a5' },
  }[status]

  return (
    <span style={{ display: 'inline-flex', padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}>
      {status}
    </span>
  )
}

export default function AdminPage() {
  const [authorized, setAuthorized] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<CoverageResponse | null>(null)

  useEffect(() => {
    const authed = hasAuthCookie()
    setAuthorized(authed)
  }, [])

  useEffect(() => {
    if (!authorized) return

    let cancelled = false
    setLoading(true)
    fetch('/api/admin/coverage', { cache: 'no-store' })
      .then(async res => {
        const data = await res.json() as CoverageResponse
        if (!res.ok) throw new Error(data.error || 'Failed to load report')
        if (!cancelled) setReport(data)
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load report')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [authorized])

  const missingCount = useMemo(() => report?.missing.length || 0, [report])

  const handleLogin = (event: React.FormEvent) => {
    event.preventDefault()
    if (password !== AUTH_PASSWORD) {
      setError('Wrong password.')
      return
    }
    setAuthCookie()
    setError('')
    setAuthorized(true)
  }

  if (!authorized) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#0a0a0b', color: '#f1f1f1' }}>
        <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: 420, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 28, boxShadow: '0 30px 80px rgba(0,0,0,0.35)' }}>
          <div style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#dc2626', marginBottom: 12 }}>Admin access</div>
          <h1 style={{ margin: '0 0 8px', fontSize: 34, lineHeight: 1 }}>Coverage dashboard</h1>
          <p style={{ margin: '0 0 20px', color: '#8f8f95', fontSize: 14 }}>Enter the admin password once, then the cookie keeps you in.</p>
          <input
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder="Password"
            style={{ width: '100%', background: '#111214', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 12, padding: '14px 16px', outline: 'none', marginBottom: 14 }}
          />
          {error && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button type="submit" style={{ width: '100%', border: 0, borderRadius: 12, padding: '14px 16px', background: '#dc2626', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Unlock dashboard</button>
        </form>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', background: '#0a0a0b', color: '#f1f1f1', padding: '28px 24px 64px' }}>
      <div style={{ maxWidth: 1500, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#dc2626', marginBottom: 10 }}>TIS dealer tool / admin</div>
            <h1 style={{ margin: 0, fontSize: 'clamp(30px, 5vw, 54px)', lineHeight: 1 }}>Image coverage report</h1>
            <p style={{ margin: '10px 0 0', color: '#8f8f95', fontSize: 14 }}>Live ToughAssets tags plus current dealer DB coverage.</p>
          </div>
          {report?.generatedAt && <div style={{ fontSize: 12, color: '#6b7280' }}>Updated {new Date(report.generatedAt).toLocaleString()}</div>}
        </div>

        {loading && <div style={{ color: '#8f8f95', marginBottom: 20 }}>Loading coverage report...</div>}
        {error && <div style={{ color: '#f87171', marginBottom: 20 }}>{error}</div>}

        {report && (
          <>
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
              {statCards.map(card => (
                <div key={card.key} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 20 }}>
                  <div style={{ color: '#8f8f95', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{card.label}</div>
                  <div style={{ fontSize: 34, fontWeight: 700 }}>{report.summary[card.key].toLocaleString()}</div>
                </div>
              ))}
            </section>

            <section style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14, gap: 16, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: 22 }}>Coverage table</h2>
                <div style={{ color: '#8f8f95', fontSize: 13 }}>{report.models.length} models</div>
              </div>
              <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, background: 'rgba(255,255,255,0.03)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1280 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', background: 'rgba(255,255,255,0.03)' }}>
                      {['Model','Brand','Sizes in catalog','Images','Has Face','Has Angle','Has Top Angle','Has Video','Size Tags','Missing Sizes','Status'].map(label => (
                        <th key={label} style={{ padding: '14px 16px', fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.models.map(row => (
                      <tr key={row.model} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', verticalAlign: 'top' }}>
                        <td style={{ padding: 16, fontWeight: 700 }}>{row.model}</td>
                        <td style={{ padding: 16, color: '#d1d5db' }}>{row.brand}</td>
                        <td style={{ padding: 16, color: '#d1d5db' }}>{row.sizesInCatalog.join(', ') || '—'}</td>
                        <td style={{ padding: 16, color: '#d1d5db' }}>{row.imageCount}</td>
                        <td style={{ padding: 16 }}><Badge ok={row.hasFace} /></td>
                        <td style={{ padding: 16 }}><Badge ok={row.hasAngle} /></td>
                        <td style={{ padding: 16 }}><Badge ok={row.hasTopAngle} /></td>
                        <td style={{ padding: 16 }}><Badge ok={row.hasVideo} /></td>
                        <td style={{ padding: 16, color: '#d1d5db' }}>{row.sizeTags.length ? row.sizeTags.join(', ') : '—'}</td>
                        <td style={{ padding: 16, color: row.missingSizes.length ? '#fca5a5' : '#86efac' }}>{row.missingSizes.length ? row.missingSizes.join(', ') : 'None'}</td>
                        <td style={{ padding: 16 }}><StatusPill status={row.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14, gap: 16, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: 22 }}>Missing images list</h2>
                <div style={{ color: '#8f8f95', fontSize: 13 }}>{missingCount} models need work</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                {report.missing.map(row => (
                  <div key={`${row.model}-missing`} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 700 }}>{row.model}</div>
                        <div style={{ color: '#9ca3af', fontSize: 13 }}>{row.brand}</div>
                      </div>
                      <StatusPill status={row.status} />
                    </div>
                    <div style={{ color: '#d1d5db', fontSize: 13, marginBottom: 8 }}><strong>Catalog sizes:</strong> {row.sizesInCatalog.join(', ') || '—'}</div>
                    <div style={{ color: '#d1d5db', fontSize: 13, marginBottom: 8 }}><strong>Tagged sizes:</strong> {row.sizeTags.join(', ') || '—'}</div>
                    <div style={{ color: '#fca5a5', fontSize: 13, marginBottom: 12 }}><strong>Missing sizes:</strong> {row.missingSizes.join(', ') || 'None'}</div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: '#9ca3af', fontSize: 12 }}>
                      <span>Face <Badge ok={row.hasFace} /></span>
                      <span>Angle <Badge ok={row.hasAngle} /></span>
                      <span>Top <Badge ok={row.hasTopAngle} /></span>
                      <span>Video <Badge ok={row.hasVideo} /></span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
