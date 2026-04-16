'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP)

interface Wheel {
  id: number
  supplier_pn: string
  oracle_id: string | null
  brand: string
  model: string
  color_finish: string
  size: string
  offset_mm: string
  bolt_pattern: string
  hub_bore: string
  placement: string
  material: string
  fitment_category: string
  msrp: number | null
  map_price: number | null
  upc: string
  image_url: string | null
  atd_url: string | null
  in_stock: number | null
  total_stock: number | null
  stock_tomorrow: number | null
  stock_national: number | null
  atd_image_url: string | null
  ta_image_url: string | null
}

interface SearchResponse {
  wheels: Wheel[]
  query_parsed: {
    vehicle: { year: number; make: string; model: string } | null
    wheelModel: string | null
    size: string | null
    finish: string | null
    boltPattern: string | null
    brand: string | null
  }
  total: number
  error?: string
}

const EXAMPLE_QUERIES = [
  'What fits a 2024 F-150?',
  '22 inch wheels for RAM 1500',
  'TIS 544 in black',
  'DTS wheels 20 inch',
  'Chrome wheels for Chevy Silverado',
  'TIS Motorsports bronze',
]

const BRAND_FILTERS = [
  { name: 'TIS', logo: '/tis-logo-white.svg', width: 44 },
  { name: 'DTS', logo: '/dts-logo-white.svg', width: 52 },
  { name: 'TIS Motorsports', logo: '/tismotorsports-logo-white.svg', width: 108 },
]

const RED_TO_BLACK_GRADIENT = 'linear-gradient(180deg, #dc2626 0%, #000000 100%)'
const RED_TO_BLACK_GRADIENT_HOVER = 'linear-gradient(180deg, #ef4444 0%, #1f1f1f 100%)'

function WheelCard({ wheel }: { wheel: Wheel }) {
  const [imgError, setImgError] = useState(false)
  const imageUrl = !imgError ? (wheel.ta_image_url || wheel.atd_image_url) : null

  useEffect(() => {
    setImgError(false)
  }, [wheel.id, wheel.ta_image_url, wheel.atd_image_url])

  const formatPrice = (price: number | null) => {
    if (price == null) return null
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price)
  }

  const brandLogoSrc =
    wheel.brand === 'TIS'
      ? '/tis-word-logo.png'
      : wheel.brand === 'DTS'
        ? '/dts-logo-white.svg'
        : wheel.brand === 'TIS Motorsports'
          ? '/tismotorsports-logo-white.svg'
          : null

  const brandLogoHeight =
    wheel.brand === 'TIS'
      ? 30
      : wheel.brand === 'DTS' || wheel.brand === 'TIS Motorsports'
        ? 45
        : 30

  return (
    <div
      className="wheel-card"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        overflow: 'visible',
        position: 'relative' as const,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(220,38,38,0.4)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 28px 80px rgba(220,38,38,0.12)'
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 20px 60px rgba(0,0,0,0.2)'
      }}
    >
      {wheel.in_stock != null && (
        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: wheel.in_stock ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: wheel.in_stock ? '#22c55e' : '#ef4444', border: `1px solid ${wheel.in_stock ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
          {wheel.in_stock ? `${wheel.total_stock || ''} in stock` : 'Out of stock'}
        </div>
      )}

      <div style={{ background: '#000', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={`${wheel.model} ${wheel.color_finish}`}
            fill
            style={{ objectFit: 'contain', padding: '12px' }}
            onError={() => setImgError(true)}
            unoptimized
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', opacity: 0.3 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="3"/>
              <line x1="12" y1="2" x2="12" y2="5"/>
              <line x1="12" y1="19" x2="12" y2="22"/>
              <line x1="2" y1="12" x2="5" y2="12"/>
              <line x1="19" y1="12" x2="22" y2="12"/>
            </svg>
            <span style={{ fontSize: '11px', fontFamily: 'inherit' }}>No image</span>
          </div>
        )}
      </div>

      <div style={{ padding: '16px' }}>
        <div style={{ marginBottom: '4px', minHeight: '16px', display: 'flex', alignItems: 'center' }}>
          {brandLogoSrc ? (
            <img
              src={brandLogoSrc}
              alt={wheel.brand}
              height={brandLogoHeight}
              style={{ height: `${brandLogoHeight}px`, width: 'auto', objectFit: 'contain' }}
            />
          ) : (
            <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {wheel.brand}
            </span>
          )}
        </div>
        <h3 style={{ fontSize: '21px', fontWeight: 700, margin: '0 0 4px', color: '#f1f1f1', lineHeight: 1.3 }}>
          {wheel.model}
        </h3>
        <p style={{ fontSize: '13px', color: '#999', margin: '0 0 12px' }}>
          {wheel.color_finish}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          {[
            { label: 'Size', value: wheel.size },
            { label: 'Bolt Pattern', value: wheel.bolt_pattern },
            { label: 'Offset', value: wheel.offset_mm ? `${wheel.offset_mm}mm` : '—' },
            { label: 'Hub Bore', value: wheel.hub_bore ? `${wheel.hub_bore}mm` : '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '6px 8px' }}>
              <div style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#ddd', marginTop: '2px' }}>{value || '—'}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'baseline' }}>
          {(wheel.msrp || wheel.map_price) != null && (
            <div>
              <div style={{ fontSize: '10px', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>MAP PRICE</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{formatPrice(wheel.msrp || wheel.map_price)}</div>
            </div>
          )}
        </div>

        {wheel.in_stock != null && wheel.total_stock != null && wheel.total_stock > 0 && (
          <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>
            {wheel.stock_tomorrow ? `${wheel.stock_tomorrow} tomorrow` : ''}
            {wheel.stock_tomorrow && wheel.stock_national ? ' · ' : ''}
            {wheel.stock_national ? `${wheel.stock_national} national (3-5 days)` : ''}
          </div>
        )}

        <div style={{ fontSize: '11px', color: '#555', marginBottom: '12px' }}>
          SKU: {wheel.supplier_pn}
          {wheel.oracle_id && <span style={{ marginLeft: '8px', color: '#444' }}>ORACLE: {wheel.oracle_id}</span>}
        </div>

        {wheel.atd_url ? (
          <a
            href={wheel.atd_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              background: RED_TO_BLACK_GRADIENT,
              color: '#fff',
              textAlign: 'center',
              padding: '10px 16px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'background 0.2s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = RED_TO_BLACK_GRADIENT_HOVER)}
            onMouseLeave={e => (e.currentTarget.style.background = RED_TO_BLACK_GRADIENT)}
          >
            Check Your Price on ATDOnline
          </a>
        ) : (
          <div style={{
            display: 'block',
            background: 'rgba(255,255,255,0.06)',
            color: '#666',
            textAlign: 'center',
            padding: '10px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
          }}>
            Not on ATD
          </div>
        )}
      </div>
    </div>
  )
}

export default function Home() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SearchResponse | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [activeBrand, setActiveBrand] = useState<string | null>(null)
  const [inStockOnly, setInStockOnly] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (hasSearched) {
      handleSearch()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inStockOnly])

  useGSAP(() => {
    gsap.from('.search-animate', {
      y: -30,
      opacity: 0,
      duration: 0.8,
      stagger: 0.1,
      ease: 'power3.out',
    })
  }, { scope: pageRef })

  useGSAP(() => {
    if (!result?.wheels?.length || loading) return

    gsap.from('.wheel-card', {
      y: 50,
      opacity: 0,
      duration: 0.6,
      stagger: 0.08,
      ease: 'power3.out',
      clearProps: 'transform,opacity',
    })
  }, { scope: pageRef, dependencies: [result?.wheels, loading], revertOnUpdate: true })

  useGSAP(() => {
    if (!hasSearched || !result || result.error) return

    gsap.from('.intent-banner', {
      x: -40,
      opacity: 0,
      duration: 0.6,
      ease: 'power3.out',
      clearProps: 'transform,opacity',
    })
  }, { scope: pageRef, dependencies: [hasSearched, result], revertOnUpdate: true })

  const handleSearch = async (q?: string, brand?: string | null) => {
    const searchQuery = q ?? query
    if (!searchQuery.trim() && !brand) return

    if (q) setQuery(q)
    setLoading(true)
    setHasSearched(true)

    const effectiveBrand = brand !== undefined ? brand : activeBrand
    const effectiveQuery = effectiveBrand && !searchQuery.toLowerCase().includes(effectiveBrand.toLowerCase())
      ? `${effectiveBrand} ${searchQuery}`.trim()
      : (searchQuery || effectiveBrand || '')

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: effectiveQuery, inStockOnly }),
      })
      const data = await res.json()
      setResult(data)
    } catch {
      setResult({ wheels: [], query_parsed: { vehicle: null, wheelModel: null, size: null, finish: null, boltPattern: null, brand: null }, total: 0, error: 'Search failed. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const handleBrandFilter = (brand: string) => {
    const next = activeBrand === brand ? null : brand
    setActiveBrand(next)
    handleSearch(query || 'wheels', next)
  }

  return (
    <div ref={pageRef} style={{ minHeight: '100vh', background: '#0a0a0b', color: '#f1f1f1', fontFamily: 'inherit' }}>
      <header style={{
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/tis-logo.png" alt="TIS" style={{ height: '28px', width: 'auto' }} />
          <span style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '0px', color: '#f1f1f1', textTransform: 'uppercase' }}>
            WHEEL SEARCH
          </span>
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
        <div style={{
          textAlign: 'center',
          padding: hasSearched ? '32px 0 24px' : '80px 0 40px',
          transition: 'padding 0.4s ease',
        }}>
          {!hasSearched && (
            <>
              <div className="search-animate" style={{
                display: 'inline-block',
                background: 'rgba(220,38,38,0.12)',
                border: '1px solid rgba(220,38,38,0.25)',
                borderRadius: '100px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#dc2626',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: '24px',
              }}>
                TIS Wheels × ATDOnline
              </div>
              <h1 style={{ fontSize: 'clamp(28px, 5vw, 52px)', fontWeight: 800, margin: '0 0 12px', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                Find the right wheel.
                <br />
                <span style={{ color: '#dc2626' }}>Ship it from ATD.</span>
              </h1>
              <p style={{ fontSize: '16px', color: '#888', margin: '0 0 40px', maxWidth: '480px', marginLeft: 'auto', marginRight: 'auto' }}>
                Search TIS wheels by vehicle fitment, model, size, or finish and get direct ATDOnline order links.
              </p>
            </>
          )}

          <div className="search-animate" style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
            {BRAND_FILTERS.map(({ name, logo, width }) => (
              <button
                key={name}
                onClick={() => handleBrandFilter(name)}
                aria-label={`Filter by ${name}`}
                style={{
                  background: activeBrand === name ? 'rgba(220,38,38,0.2)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${activeBrand === name ? 'rgba(220,38,38,0.6)' : 'rgba(255,255,255,0.1)'}`,
                  color: activeBrand === name ? '#dc2626' : '#aaa',
                  padding: '10px 16px',
                  borderRadius: '100px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '44px',
                  minWidth: name === 'TIS Motorsports' ? '152px' : '92px',
                }}
                onMouseEnter={e => {
                  if (activeBrand !== name) {
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.2)'
                  }
                }}
                onMouseLeave={e => {
                  if (activeBrand !== name) {
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)'
                  }
                }}
              >
                <img src={logo} alt={name} style={{ height: '22px', width: `${width}px`, objectFit: 'contain', display: 'block' }} />
              </button>
            ))}
          </div>

          <div className="search-animate" style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#ddd', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={e => setInStockOnly(e.target.checked)}
                style={{ accentColor: '#dc2626', cursor: 'pointer' }}
              />
              In Stock Only
            </label>
          </div>

          <div className="search-animate" style={{
            maxWidth: '640px',
            margin: '0 auto',
            position: 'relative',
          }}>
            <div style={{
              display: 'flex',
              gap: '0',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '12px',
              overflow: 'hidden',
              transition: 'border-color 0.2s',
            }}
              onFocusCapture={e => (e.currentTarget.style.borderColor = 'rgba(220,38,38,0.5)')}
              onBlurCapture={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
            >
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search by vehicle, model, size, or finish..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#f1f1f1',
                  fontSize: '16px',
                  padding: '16px 20px',
                  fontFamily: 'inherit',
                }}
              />
              <button
                onClick={() => handleSearch()}
                disabled={loading || !query.trim()}
                style={{
                  background: loading ? '#555' : RED_TO_BLACK_GRADIENT,
                  color: '#fff',
                  border: 'none',
                  padding: '12px 24px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 700,
                  fontFamily: 'inherit',
                  letterSpacing: '0.04em',
                  transition: 'background 0.2s',
                  minWidth: '100px',
                }}
                onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = RED_TO_BLACK_GRADIENT_HOVER }}
                onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = RED_TO_BLACK_GRADIENT }}
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
                      <path d="M21 12a9 9 0 11-6.219-8.56"/>
                    </svg>
                    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                  </span>
                ) : 'Search'}
              </button>
            </div>
          </div>

          {!hasSearched && (
            <div style={{ marginTop: '20px', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {EXAMPLE_QUERIES.map(q => (
                <button
                  key={q}
                  onClick={() => handleSearch(q)}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#aaa',
                    padding: '7px 14px',
                    borderRadius: '100px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.2)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = '#f1f1f1'
                  }}
                  onMouseLeave={e => {
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = '#aaa'
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>

        {hasSearched && (
          <div>
            {result && !result.error && result.query_parsed && (
              <div
                className="intent-banner"
                style={{
                  background: 'rgba(220,38,38,0.08)',
                  border: '1px solid rgba(220,38,38,0.15)',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  marginBottom: '24px',
                  fontSize: '13px',
                  color: '#dc2626',
                  display: 'flex',
                  gap: '16px',
                  flexWrap: 'wrap',
                }}
              >
                {result.query_parsed.vehicle && (
                  <span>{result.query_parsed.vehicle.year} {result.query_parsed.vehicle.make} {result.query_parsed.vehicle.model}</span>
                )}
                {result.query_parsed.wheelModel && <span>Model: {result.query_parsed.wheelModel}</span>}
                {result.query_parsed.size && <span>Size: {result.query_parsed.size}&quot;</span>}
                {result.query_parsed.finish && <span>Finish: {result.query_parsed.finish}</span>}
                {result.query_parsed.boltPattern && <span>Bolt: {result.query_parsed.boltPattern}</span>}
                {result.query_parsed.brand && <span>Brand: {result.query_parsed.brand}</span>}
                <span style={{ marginLeft: 'auto', color: '#aaa' }}>{result.total} result{result.total !== 1 ? 's' : ''}</span>
              </div>
            )}

            {result?.error && (
              <div style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '8px',
                padding: '16px',
                color: '#f87171',
                marginBottom: '24px',
              }}>
                {result.error}
              </div>
            )}

            {loading && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '12px',
                    height: '380px',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }}>
                    <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.7} }`}</style>
                  </div>
                ))}
              </div>
            )}

            {!loading && result && result.wheels.length === 0 && !result.error && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#555' }}>
                <p style={{ fontSize: '16px', marginBottom: '8px', color: '#777' }}>No wheels found for that search.</p>
                <p style={{ fontSize: '13px' }}>Try a different year, model, or size.</p>
              </div>
            )}

            {!loading && result && result.wheels.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', paddingBottom: '60px' }}>
                {result.wheels.map(wheel => (
                  <WheelCard key={wheel.id} wheel={wheel} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
