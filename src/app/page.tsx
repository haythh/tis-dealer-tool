'use client'

import { useState, useRef, useEffect, type CSSProperties } from 'react'
import Image from 'next/image'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import officialWheelVideos from '@/data/official-wheel-videos.json'
import tisTiresData from '@/data/tis-tires.json'

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
  ta_images_json: string | null
}

interface GalleryItem {
  url: string
  type: 'face' | 'angle' | 'topangle' | 'video' | 'other'
  fullUrl: string
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
  fitment_status?: 'exact' | 'bolt_pattern' | 'demo_fallback' | 'catalog_search'
  matched_bolt_patterns?: string[]
  notice?: string | null
  suggested_queries?: string[]
  error?: string
}

interface Tire {
  id: string
  line: 'RT1' | 'TT1'
  name: string
  terrain: string
  sourceUrl: string
  heroImageUrl: string
  logoUrl: string
  itemNo: string | null
  size: string
  rimDiameter: number | null
  tirePly: number | null
  loadRange: string | null
  loadIndex: string | null
  speedRating: string | null
  sidewall: string | null
  treadDepth: number | null
  tireDiameter: number | null
  sectionWidth: number | null
  minRimWidth: number | null
  maxRimWidth: number | null
  singleMaxLoad: string | null
  dualMaxLoad: string | null
  maxTirePressure: number | null
  weight: number | null
  retailPrice: number | 'TBD' | null
  imageUrls?: string[]
  imageMatch?: string
  atdUrl?: string | null
  atdProductNumber?: string | null
  atdSupplierNumber?: string | null
  atdLookupStatus?: string | null
}

type TireData = {
  counts: Record<string, number>
  generatedAt: string
  tires: Tire[]
}

const EXAMPLE_QUERIES = [
  'What fits a 2024 F-150?',
  '20" wheels for RAM 1500',
  'TIS 544 in black',
  'DTS wheels 20 inch',
  'Chrome wheels for Chevy Silverado',
  'TIS Motorsports bronze',
]

const BRAND_FILTERS = [
  { name: 'TIS', label: 'TIS' },
  { name: 'DTS', label: 'DTS' },
  { name: 'TIS Motorsports', label: 'TIS MOTORSPORTS' },
]

const SAFE_DEMO_SEARCHES = ['2024 F-150', '2024 Silverado 1500', '2023 RAM 1500', '2024 Tacoma', '2024 Bronco', '6x5.50 20 inch black']

type OfficialWheelVideo = {
  code: string
  videoUrl: string
  pageUrl: string
  sourceSite: string
}

const officialVideosByCode = officialWheelVideos.videosByCode as Record<string, OfficialWheelVideo>
const tireData = tisTiresData as TireData

function wheelModelVideoCodes(model: string) {
  const compact = model.toUpperCase().replace(/[^A-Z0-9.]/g, '')
  const candidates = new Set<string>([
    compact,
    compact.replace('2.0', '2'),
    compact.replace(/DUALLYINNER|DUALLY/g, ''),
    compact.replace(/DUALLYINNER|DUALLY/g, '').replace('2.0', '2'),
  ])

  const base = compact.match(/^(\d{3}[A-Z0-9]*)/)
  if (base) candidates.add(base[1])

  return [...candidates].filter(Boolean)
}

function officialVideoForWheel(wheel: Wheel) {
  for (const code of wheelModelVideoCodes(wheel.model)) {
    const video = officialVideosByCode[code]
    if (video) return video
  }

  return null
}

function WheelCard({ wheel, themeMode }: { wheel: Wheel; themeMode: 'dark' | 'light' }) {
  const isLightMode = themeMode === 'light'

  const parseGallery = (): GalleryItem[] => {
    try {
      const parsed = wheel.ta_images_json ? JSON.parse(wheel.ta_images_json) : []
      if (Array.isArray(parsed) && parsed.length) {
        const priority: Record<GalleryItem['type'], number> = { face: 0, angle: 1, topangle: 2, other: 3, video: 4 }
        const officialVideo = officialVideoForWheel(wheel)
        const sortedMedia = parsed
          .filter(item => item?.url || item?.fullUrl)
          .sort((a, b) => (priority[a.type as GalleryItem['type']] ?? 9) - (priority[b.type as GalleryItem['type']] ?? 9)) as GalleryItem[]
        const imageItems = sortedMedia.filter(item => item.type !== 'video')

        if (officialVideo) {
          const visibleImages = imageItems.slice(0, 4)
          const poster = visibleImages[0]?.url || wheel.ta_image_url || wheel.atd_image_url || ''
          return [
            ...visibleImages,
            { url: poster, type: 'video', fullUrl: officialVideo.videoUrl },
          ]
        }

        const videoItems = sortedMedia.filter(item => item.type === 'video')
        const visibleImages = imageItems.slice(0, videoItems.length ? 4 : 5)
        return [...visibleImages, ...videoItems].slice(0, 5)
      }
    } catch {}

    const fallbackImage = wheel.ta_image_url || wheel.atd_image_url
    const officialVideo = officialVideoForWheel(wheel)

    if (officialVideo) {
      return [
        ...(fallbackImage ? [{ url: fallbackImage, type: 'other' as const, fullUrl: fallbackImage }] : []),
        { url: fallbackImage || '', type: 'video', fullUrl: officialVideo.videoUrl },
      ]
    }

    if (fallbackImage) {
      return [{ url: fallbackImage, type: 'other', fullUrl: fallbackImage }]
    }

    return []
  }

  const gallery = parseGallery()
  const initialSelected = gallery[0] ?? null
  const [imgError, setImgError] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState<GalleryItem | null>(initialSelected)
  // Prefer the thumb URL (`url`) over `fullUrl` for images: the ToughAssets
  // `/api/file/<id>` binary endpoint (fullUrl) is currently unreliable, while
  // `cdn.toughassets.com/thumbs/...` (url) is served from CDN and stable.
  const imageUrl = !imgError ? (selectedMedia?.type === 'video' ? null : (selectedMedia?.url || selectedMedia?.fullUrl || wheel.ta_image_url || wheel.atd_image_url)) : null
  const videoUrl = selectedMedia?.type === 'video' ? selectedMedia.fullUrl : null
  const hasVideo = gallery.some(item => item.type === 'video')

  useEffect(() => {
    setImgError(false)
    setSelectedMedia(gallery[0] ?? null)
  }, [wheel.id, wheel.ta_image_url, wheel.ta_images_json, wheel.atd_image_url])

  const formatPrice = (price: number | null) => {
    if (price == null) return null
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price)
  }

  const brandLogoSrc =
    wheel.brand === 'TIS'
      ? '/tis-word-logo.png'
      : wheel.brand === 'DTS'
        ? '/dts-logo-white.png'
        : wheel.brand === 'TIS Motorsports'
          ? '/tismotorsports-word-logo.png'
          : null

  const brandLogoHeight =
    wheel.brand === 'TIS'
      ? 22
      : wheel.brand === 'DTS'
        ? 22
        : wheel.brand === 'TIS Motorsports'
          ? 19
          : 30

  return (
    <div
      className="wheel-card"
      style={{
        background: isLightMode ? '#ffffff' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${isLightMode ? 'rgba(15,15,18,0.10)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: '12px',
        overflow: 'visible',
        position: 'relative' as const,
        boxShadow: isLightMode ? '0 20px 50px rgba(15,15,18,0.08)' : '0 20px 60px rgba(0,0,0,0.2)',
      }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(220,38,38,0.4)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 28px 80px rgba(220,38,38,0.12)'
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLElement).style.borderColor = isLightMode ? 'rgba(15,15,18,0.10)' : 'rgba(255,255,255,0.08)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = isLightMode ? '0 20px 50px rgba(15,15,18,0.08)' : '0 20px 60px rgba(0,0,0,0.2)'
      }}
    >
      {wheel.in_stock != null && (
        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: wheel.in_stock ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: wheel.in_stock ? '#22c55e' : '#ef4444', border: `1px solid ${wheel.in_stock ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
          {wheel.in_stock ? `${wheel.total_stock || ''} in stock` : 'Out of stock'}
        </div>
      )}

      <div style={{ background: isLightMode ? '#f4f4f5' : '#000', height: '360px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        {selectedMedia?.type === 'video' && videoUrl ? (
          <video
            src={videoUrl}
            poster={selectedMedia.url}
            controls
            muted
            loop
            playsInline
            preload="metadata"
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.12)', transformOrigin: 'center center' }}
          />
        ) : imageUrl ? (
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

      {gallery.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', padding: '8px', background: isLightMode ? '#f8f8f8' : '#0a0a0a', overflowX: 'auto' }}>
          {gallery.map((item, index) => {
            const active = selectedMedia?.fullUrl === item.fullUrl && selectedMedia?.type === item.type
            return (
              <button
                key={`${item.fullUrl}-${index}`}
                onClick={() => {
                  setImgError(false)
                  setSelectedMedia(item)
                }}
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '4px',
                  border: `2px solid ${active ? '#dc2626' : 'rgba(255,255,255,0.14)'}`,
                  background: isLightMode ? '#fff' : '#111',
                  padding: 0,
                  cursor: 'pointer',
                  overflow: 'hidden',
                  position: 'relative',
                  flex: '0 0 auto',
                }}
                aria-label={`Show ${item.type} media`}
              >
                {item.type === 'video' ? (
                  <>
                    <img src={item.url} alt={`${wheel.model} video thumbnail`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.28)' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                    <span style={{ position: 'absolute', bottom: 3, left: 4, right: 4, borderRadius: '3px', background: 'rgba(220,38,38,0.88)', color: '#fff', fontSize: '8px', fontWeight: 900, letterSpacing: '0.08em', padding: '2px 0' }}>VIDEO</span>
                  </>
                ) : (
                  <img src={item.url} alt={`${wheel.model} ${item.type} thumbnail`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                )}
              </button>
            )
          })}
        </div>
      )}

      <div style={{ padding: '16px' }}>
        <div style={{ marginBottom: '4px', minHeight: '16px', display: 'block', textAlign: 'left' }}>
          {brandLogoSrc ? (
            <img
              src={brandLogoSrc}
              alt={wheel.brand}
              height={brandLogoHeight}
              style={{ height: `${brandLogoHeight}px`, width: 'auto', objectFit: 'contain', margin: wheel.brand === 'TIS Motorsports' || wheel.brand === 'TIS' ? '0' : undefined, display: wheel.brand === 'TIS Motorsports' || wheel.brand === 'TIS' ? 'inline-block' : undefined }}
            />
          ) : (
            <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {wheel.brand}
            </span>
          )}
        </div>
        <h3 style={{ fontSize: '21px', fontWeight: 700, margin: '0 0 4px', color: isLightMode ? '#111113' : '#f1f1f1', lineHeight: 1.3 }}>
          {wheel.model}
          {hasVideo && <span style={{ marginLeft: '8px', fontSize: '10px', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.35)', borderRadius: '999px', padding: '3px 7px', verticalAlign: 'middle', letterSpacing: '0.08em' }}>VIDEO</span>}
        </h3>
        <p style={{ fontSize: '13px', color: isLightMode ? '#62626a' : '#999', margin: '0 0 12px' }}>
          {wheel.color_finish}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          {[
            { label: 'Size', value: wheel.size },
            { label: 'Bolt Pattern', value: wheel.bolt_pattern },
            { label: 'Offset', value: wheel.offset_mm ? `${wheel.offset_mm}mm` : '—' },
            { label: 'Hub Bore', value: wheel.hub_bore ? `${wheel.hub_bore}mm` : '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: isLightMode ? '#f5f5f6' : 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '6px 8px' }}>
              <div style={{ fontSize: '10px', color: isLightMode ? '#74747b' : '#666', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: isLightMode ? '#242428' : '#ddd', marginTop: '2px' }}>{value || '—'}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'baseline' }}>
          {(wheel.msrp || wheel.map_price) != null && (
            <div>
              <div style={{ fontSize: '10px', color: isLightMode ? '#52525b' : '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>MAP PRICE</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: isLightMode ? '#111113' : '#fff' }}>{formatPrice(wheel.msrp || wheel.map_price)}</div>
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
            className="btn-slide btn-slide-link"
            style={{
              display: 'block',
              textAlign: 'center',
              textDecoration: 'none',
              fontFamily: 'inherit',
            }}
          >
            <span style={{ position: 'relative', zIndex: 2 }}>Check Your Price on ATDOnline</span>
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

function TireCard({ tire, themeMode }: { tire: Tire; themeMode: 'dark' | 'light' }) {
  const isLightMode = themeMode === 'light'
  const tireImages = tire.imageUrls?.length ? tire.imageUrls : [tire.heroImageUrl].filter(Boolean)
  const [selectedImage, setSelectedImage] = useState(tireImages[0] || '')
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    setSelectedImage(tireImages[0] || '')
    setImgError(false)
  }, [tire.id, tire.heroImageUrl, tire.imageUrls?.join('|')])

  const imageUrl = !imgError ? selectedImage : ''
  const formatPrice = (price: Tire['retailPrice']) => {
    if (price == null) return null
    if (price === 'TBD') return 'TBD'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(price)
  }
  const price = formatPrice(tire.retailPrice)

  return (
    <div
      className="wheel-card"
      style={{
        background: isLightMode ? '#ffffff' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${isLightMode ? 'rgba(15,15,18,0.10)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: '12px',
        overflow: 'visible',
        position: 'relative',
        boxShadow: isLightMode ? '0 20px 50px rgba(15,15,18,0.08)' : '0 20px 60px rgba(0,0,0,0.2)',
      }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(220,38,38,0.4)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 28px 80px rgba(220,38,38,0.12)'
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLElement).style.borderColor = isLightMode ? 'rgba(15,15,18,0.10)' : 'rgba(255,255,255,0.08)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = isLightMode ? '0 20px 50px rgba(15,15,18,0.08)' : '0 20px 60px rgba(0,0,0,0.2)'
      }}
    >
      <div style={{ background: isLightMode ? '#f4f4f5' : '#000', height: '360px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`${tire.line} ${tire.size}`}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '12px' }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', opacity: 0.3 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span style={{ fontSize: '11px', fontFamily: 'inherit' }}>No image</span>
          </div>
        )}
      </div>

      {tireImages.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', padding: '8px', background: isLightMode ? '#f8f8f8' : '#0a0a0a', overflowX: 'auto' }}>
          {tireImages.map((image, index) => {
            const active = selectedImage === image
            return (
              <button
                key={`${image}-${index}`}
                onClick={() => {
                  setImgError(false)
                  setSelectedImage(image)
                }}
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '4px',
                  border: `2px solid ${active ? '#dc2626' : 'rgba(255,255,255,0.14)'}`,
                  background: isLightMode ? '#fff' : '#111',
                  padding: 0,
                  cursor: 'pointer',
                  overflow: 'hidden',
                  position: 'relative',
                  flex: '0 0 auto',
                }}
                aria-label={`Show ${tire.line} ${tire.size} angle ${index + 1}`}
              >
                <img src={image} alt={`${tire.line} ${tire.size} thumbnail ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </button>
            )
          })}
        </div>
      )}

      <div style={{ padding: '16px' }}>
        <div style={{ marginBottom: '4px', minHeight: '16px', display: 'block', textAlign: 'left' }}>
          <img src="/tis-word-logo.png" alt="TIS" height={22} style={{ height: '22px', width: 'auto', objectFit: 'contain', margin: 0, display: 'inline-block' }} />
        </div>
        <h3 style={{ fontSize: '21px', fontWeight: 700, margin: '0 0 4px', color: isLightMode ? '#111113' : '#f1f1f1', lineHeight: 1.3 }}>
          {tire.line} {tire.size}
        </h3>
        <p style={{ fontSize: '13px', color: isLightMode ? '#62626a' : '#999', margin: '0 0 12px' }}>
          {tire.terrain}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          {[
            { label: 'Size', value: tire.size },
            { label: 'Load Range', value: [tire.tirePly, tire.loadRange].filter(Boolean).join(' / ') || '—' },
            { label: 'Load / Speed', value: [tire.loadIndex, tire.speedRating].filter(Boolean).join(' / ') || '—' },
            { label: 'Tread Depth', value: tire.treadDepth ? `${tire.treadDepth}/32\"` : '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: isLightMode ? '#f5f5f6' : 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '6px 8px' }}>
              <div style={{ fontSize: '10px', color: isLightMode ? '#74747b' : '#666', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: isLightMode ? '#242428' : '#ddd', marginTop: '2px' }}>{value || '—'}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'baseline' }}>
          {price && (
            <div>
              <div style={{ fontSize: '10px', color: isLightMode ? '#52525b' : '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>RETAIL PRICE</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: isLightMode ? '#111113' : '#fff' }}>{price}</div>
            </div>
          )}
        </div>

        <div style={{ fontSize: '11px', color: '#555', marginBottom: '12px' }}>
          SKU: {tire.atdProductNumber || tire.itemNo || '—'}
          {tire.itemNo && tire.atdProductNumber && tire.itemNo !== tire.atdProductNumber && <span style={{ marginLeft: '8px', color: '#444' }}>ITEM: {tire.itemNo}</span>}
        </div>

        {tire.atdUrl ? (
          <a href={tire.atdUrl} target="_blank" rel="noopener noreferrer" className="btn-slide btn-slide-link" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', fontFamily: 'inherit' }}>
            <span style={{ position: 'relative', zIndex: 2 }}>Check Your Price on ATDOnline</span>
          </a>
        ) : (
          <div style={{ display: 'block', background: 'rgba(255,255,255,0.06)', color: '#666', textAlign: 'center', padding: '10px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 500 }}>
            ATD link pending
          </div>
        )}
      </div>
    </div>
  )
}

function TireSearchPanel({ themeMode }: { themeMode: 'dark' | 'light' }) {
  const [query, setQuery] = useState('')
  const [activeLine, setActiveLine] = useState<'ALL' | 'RT1' | 'TT1'>('ALL')
  const [activeRim, setActiveRim] = useState<number | 'ALL'>('ALL')

  const tires = tireData.tires
  const rimDiameters = Array.from(new Set(tires.map(tire => tire.rimDiameter).filter((rim): rim is number => typeof rim === 'number'))).sort((a, b) => a - b)
  const lineCounts = tires.reduce<Record<string, number>>((acc, tire) => {
    acc[tire.line] = (acc[tire.line] || 0) + 1
    return acc
  }, {})

  const normalizedQuery = query.trim().toLowerCase()
  const filteredTires = tires.filter(tire => {
    if (activeLine !== 'ALL' && tire.line !== activeLine) return false
    if (activeRim !== 'ALL' && tire.rimDiameter !== activeRim) return false
    if (!normalizedQuery) return true

    return [
      tire.line,
      tire.name,
      tire.terrain,
      tire.itemNo,
      tire.size,
      tire.loadRange,
      tire.loadIndex,
      tire.speedRating,
      tire.singleMaxLoad,
    ].filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery)
  })

  const chipStyle = (active: boolean): CSSProperties => ({
    background: active ? 'rgba(220,38,38,0.22)' : 'var(--search-bg)',
    border: `1px solid ${active ? 'rgba(220,38,38,0.62)' : 'var(--panel-border)'}`,
    color: active ? '#fff' : 'var(--page-text)',
    padding: '10px 14px',
    borderRadius: '14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '13px',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  })

  return (
    <div style={{ padding: '44px 0 64px' }}>
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div className="search-animate" style={{ display: 'inline-block', border: '1px solid rgba(220,38,38,0.32)', borderRadius: 999, padding: '7px 16px', fontSize: 12, fontWeight: 800, color: '#fecaca', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 18 }}>
          TIS Tires × Hercules specs
        </div>
        <h1 className="search-animate" style={{ fontSize: 'clamp(38px, 7vw, 80px)', fontWeight: 950, margin: '0 0 14px', letterSpacing: 0, lineHeight: 0.92, textTransform: 'uppercase' }}>
          TIRE SEARCH
        </h1>
        <p className="search-animate" style={{ fontSize: 18, color: 'var(--muted-text)', margin: '0 auto', maxWidth: 680, lineHeight: 1.6 }}>
          Search RT1 rugged-terrain and TT1 mud-terrain specs by size, wheel diameter, load range, item number, or ply.
        </p>
      </div>

      <div className="search-frame" style={{ maxWidth: 960, margin: '0 auto 24px' }}>
        <div className="search-glow" />
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) auto', gap: 12, alignItems: 'center' }}>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search 35x12.50, 20, 98824, Load E..."
            style={{ background: 'var(--search-bg)', border: '1px solid var(--panel-border)', borderRadius: 12, color: 'var(--page-text)', fontSize: 16, padding: '15px 18px', fontFamily: 'inherit', outline: 'none', minWidth: 0 }}
          />
          <span style={{ color: 'var(--soft-text)', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            {filteredTires.length} / {tires.length} tires
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
          {(['ALL', 'RT1', 'TT1'] as const).map(line => (
            <button key={line} type="button" onClick={() => setActiveLine(line)} style={chipStyle(activeLine === line)}>
              {line === 'ALL' ? `All (${tires.length})` : `${line} (${lineCounts[line] || 0})`}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <button type="button" onClick={() => setActiveRim('ALL')} style={chipStyle(activeRim === 'ALL')}>All diameters</button>
          {rimDiameters.map(rim => (
            <button key={rim} type="button" onClick={() => setActiveRim(rim)} style={chipStyle(activeRim === rim)}>{rim}&quot;</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {filteredTires.map(tire => (
          <TireCard key={tire.id} tire={tire} themeMode={themeMode} />
        ))}
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
  const [activeTab, setActiveTab] = useState<'wheel' | 'tire'>('wheel')
  const [inStockOnly, setInStockOnly] = useState(true)
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark')
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

    gsap.to('.ambient-orb', {
      y: i => (i % 2 === 0 ? -28 : 24),
      x: i => (i % 2 === 0 ? 18 : -18),
      scale: i => (i % 2 === 0 ? 1.08 : 0.94),
      duration: 5.5,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      stagger: 0.5,
    })

    gsap.from('.stat-card', {
      y: 22,
      opacity: 0,
      duration: 0.7,
      stagger: 0.08,
      delay: 0.25,
      ease: 'power3.out',
    })

    gsap.to('.search-glow', {
      opacity: 0.75,
      scale: 1.04,
      duration: 2.2,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    })
  }, { scope: pageRef })

  useGSAP(() => {
    if (!result?.wheels?.length || loading) return

    gsap.from('.wheel-card', {
      y: 50,
      opacity: 0,
      scale: 0.97,
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

  const isResultsView = activeTab === 'tire' || Boolean(result) || loading

  return (
    <>
      <style jsx global>{`
        body {
          background: #000000;
        }

        .theme-dark {
          --page-bg: #000000;
          --page-text: #f4f4f5;
          --muted-text: #b7b7b7;
          --soft-text: #9a9aa1;
          --header-bg: rgba(0,0,0,0.74);
          --header-border: rgba(255,255,255,0.08);
          --panel-bg: rgba(255,255,255,0.055);
          --panel-border: rgba(255,255,255,0.11);
          --search-bg: rgba(255,255,255,0.05);
          --grid-line: rgba(255,255,255,0.055);
          --shell-gradient: radial-gradient(circle at 16% 8%, rgba(220,38,38,0.20), transparent 30%), radial-gradient(circle at 86% 0%, rgba(255,255,255,0.08), transparent 24%), linear-gradient(180deg, #000000 0%, #000000 52%, #050505 100%);
        }

        .theme-light {
          --page-bg: #f6f6f7;
          --page-text: #101012;
          --muted-text: #4e4e55;
          --soft-text: #696970;
          --header-bg: rgba(255,255,255,0.82);
          --header-border: rgba(15,15,18,0.10);
          --panel-bg: rgba(255,255,255,0.72);
          --panel-border: rgba(15,15,18,0.10);
          --search-bg: rgba(255,255,255,0.88);
          --grid-line: rgba(15,15,18,0.055);
          --shell-gradient: radial-gradient(circle at 16% 8%, rgba(220,38,38,0.10), transparent 28%), radial-gradient(circle at 86% 0%, rgba(0,0,0,0.06), transparent 22%), linear-gradient(180deg, #ffffff 0%, #f6f6f7 54%, #eeeeef 100%);
        }

        .btn-slide {
          background: #1a1a1a;
          color: #e8e8e8;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 15px;
          padding: 15px 25px;
          font-weight: 700;
          font-size: 15px;
          box-shadow: 4px 8px 19px -3px rgba(0,0,0,0.27);
          position: relative;
          overflow: hidden;
          z-index: 1;
          transition: all 250ms;
          cursor: pointer;
        }

        .btn-slide::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          width: 0;
          border-radius: 15px;
          background: #dc2626;
          z-index: -1;
          transition: all 250ms;
        }

        .btn-slide:hover {
          color: #fff;
        }

        .btn-slide:hover::before {
          width: 100%;
        }

        .btn-slide:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .btn-slide:disabled::before {
          width: 0;
        }

        .btn-slide-link {
          display: block;
          width: 100%;
        }

        .demo-shell {
          position: relative;
          overflow: hidden;
          background: var(--shell-gradient);
        }

        .demo-shell.results-view {
          background: #000000;
        }

        .demo-shell::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.28;
          background-image:
            linear-gradient(var(--grid-line) 1px, transparent 1px),
            linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
          background-size: 58px 58px;
          mask-image: linear-gradient(to bottom, black, transparent 72%);
        }

        .demo-shell.results-view::before {
          opacity: 0;
        }

        .ambient-orb {
          position: absolute;
          pointer-events: none;
          border-radius: 999px;
          filter: blur(12px);
          opacity: 0.72;
        }

        .demo-shell.results-view .ambient-orb,
        .demo-shell.results-view .search-glow {
          display: none;
        }

        .search-frame {
          position: relative;
          isolation: isolate;
          border-radius: 24px;
          padding: 18px;
          background: var(--panel-bg);
          border: 1px solid var(--panel-border);
          box-shadow: 0 28px 100px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.08);
          backdrop-filter: blur(18px);
        }

        .search-glow {
          position: absolute;
          inset: -2px;
          z-index: -1;
          border-radius: 26px;
          background: linear-gradient(90deg, rgba(220,38,38,0.55), rgba(255,255,255,0.08), rgba(220,38,38,0.25));
          filter: blur(18px);
          opacity: 0.35;
        }

        .glass-card {
          background: var(--panel-bg);
          border: 1px solid var(--panel-border);
          box-shadow: 0 16px 60px rgba(0,0,0,0.24);
          backdrop-filter: blur(16px);
        }

        .stat-card {
          border-radius: 16px;
          padding: 14px 16px;
          min-width: 128px;
          text-align: left;
        }

        .demo-pill {
          position: relative;
          overflow: hidden;
        }

        .demo-pill::after {
          content: '';
          position: absolute;
          top: 0;
          left: -75%;
          width: 40%;
          height: 100%;
          transform: skewX(-20deg);
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent);
          transition: left 500ms ease;
        }

        .demo-pill:hover::after {
          left: 130%;
        }

        .theme-toggle {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px;
          border-radius: 999px;
          border: 1px solid var(--header-border);
          background: var(--panel-bg);
          color: var(--page-text);
        }

        .theme-toggle button {
          border: 0;
          border-radius: 999px;
          padding: 7px 11px;
          font-family: inherit;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          color: var(--soft-text);
          background: transparent;
          transition: background 180ms ease, color 180ms ease, transform 180ms ease;
        }

        .theme-toggle button.active {
          background: #dc2626;
          color: #fff;
        }

        .theme-toggle button:active {
          transform: scale(0.97);
        }

        @media (max-width: 720px) {
          .search-frame { padding: 12px; border-radius: 18px; }
          .hero-stats { grid-template-columns: 1fr; }
        }
      `}</style>
      <div ref={pageRef} className={`demo-shell theme-${themeMode}${isResultsView ? ' results-view' : ''}`} style={{ minHeight: '100vh', color: 'var(--page-text)', fontFamily: 'inherit' }}>
      <div className="ambient-orb" style={{ width: 260, height: 260, left: -80, top: 120, background: 'rgba(220,38,38,0.24)' }} />
      <div className="ambient-orb" style={{ width: 220, height: 220, right: -70, top: 48, background: 'rgba(255,255,255,0.12)' }} />
      <div className="ambient-orb" style={{ width: 320, height: 320, right: '12%', bottom: 180, background: 'rgba(220,38,38,0.12)' }} />
      <header style={{
        borderBottom: '1px solid var(--header-border)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        position: 'relative',
        zIndex: 2,
        backdropFilter: 'blur(14px)',
        background: 'var(--header-bg)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a href="/" aria-label="TIS Dealer Tool home" style={{ display: 'inline-flex', alignItems: 'center' }}>
            <img src="/tis-logo.png" alt="TIS" style={{ height: '28px', width: 'auto', filter: themeMode === 'light' ? 'brightness(0)' : 'none' }} />
          </a>
          <nav aria-label="Dealer tool sections" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {([
              ['wheel', 'Wheel Search'],
              ['tire', 'Tire Search'],
            ] as const).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  background: activeTab === tab ? '#dc2626' : 'transparent',
                  border: `1px solid ${activeTab === tab ? 'rgba(220,38,38,0.8)' : 'var(--header-border)'}`,
                  borderRadius: 999,
                  color: activeTab === tab ? '#fff' : 'var(--page-text)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: '0.05em',
                  padding: '8px 12px',
                  textTransform: 'uppercase',
                }}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div className="theme-toggle" aria-label="Color mode switch">
            <button type="button" className={themeMode === 'light' ? 'active' : ''} onClick={() => setThemeMode('light')}>Light</button>
            <button type="button" className={themeMode === 'dark' ? 'active' : ''} onClick={() => setThemeMode('dark')}>Dark</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--soft-text)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: '#22c55e', boxShadow: '0 0 18px rgba(34,197,94,0.85)' }} />
            ATD demo mode
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1220px', margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 1 }}>
        {activeTab === 'wheel' ? (
          <>
        <div style={{
          textAlign: 'center',
          padding: hasSearched ? '32px 0 24px' : '76px 0 42px',
          transition: 'padding 0.4s ease',
        }}>
          {!hasSearched && (
            <>
              <div className="search-animate" style={{
                display: 'inline-block',
                background: 'linear-gradient(90deg, rgba(220,38,38,0.18), rgba(255,255,255,0.07))',
                border: '1px solid rgba(220,38,38,0.32)',
                borderRadius: '100px',
                padding: '7px 16px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#fecaca',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: '24px',
              }}>
                TIS Wheels × ATDOnline concept preview
              </div>
              <h1 className="search-animate" style={{ fontSize: 'clamp(38px, 7vw, 86px)', fontWeight: 950, margin: '0 0 14px', letterSpacing: 0, lineHeight: 0.92, textTransform: 'uppercase' }}>
                FIND THE WHEEL YOU NEED FAST AND EASY
              </h1>
              <p className="search-animate" style={{ fontSize: '18px', color: 'var(--muted-text)', margin: '0 0 34px', maxWidth: '680px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
                A dealer-first wheel finder with visual media, fitment-aware search, live-order intent, and direct ATDOnline handoff.
              </p>
            </>
          )}

          <div className="search-animate search-frame" style={{ maxWidth: 800, margin: '0 auto' }}>
            <div className="search-glow" />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
            {BRAND_FILTERS.map(({ name, label }) => (
              <button
                key={name}
                onClick={() => handleBrandFilter(name)}
                aria-label={`Filter by ${name}`}
                style={{
                  background: activeBrand === name ? 'rgba(220,38,38,0.2)' : 'var(--search-bg)',
                  border: `1px solid ${activeBrand === name ? 'rgba(220,38,38,0.6)' : 'var(--panel-border)'}`,
                  color: 'var(--page-text)',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
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
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--search-bg)'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--panel-border)'
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#ddd', fontSize: '13px', cursor: 'pointer', textTransform: 'uppercase' }}>
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={e => setInStockOnly(e.target.checked)}
                style={{ accentColor: '#dc2626', cursor: 'pointer' }}
              />
              IN STOCK ONLY
            </label>
          </div>

          <div style={{
            maxWidth: '640px',
            margin: '0 auto',
            position: 'relative',
          }}>
            <div style={{
              display: 'flex',
              gap: '0',
              background: 'var(--search-bg)',
              border: '1px solid var(--panel-border)',
              borderRadius: '12px',
              overflow: 'hidden',
              transition: 'border-color 0.2s',
            }}
              onFocusCapture={e => (e.currentTarget.style.borderColor = 'rgba(220,38,38,0.5)')}
              onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--panel-border)')}
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
                  color: 'var(--page-text)',
                  fontSize: '16px',
                  padding: '16px 20px',
                  fontFamily: 'inherit',
                }}
              />
              <button
                onClick={() => handleSearch()}
                disabled={loading || !query.trim()}
                className="btn-slide"
                style={{
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                  borderTop: 'none',
                  borderRight: 'none',
                  borderBottom: 'none',
                  boxShadow: 'none',
                  minWidth: '100px',
                  fontFamily: 'inherit',
                  letterSpacing: '0.04em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative', zIndex: 2 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
                      <path d="M21 12a9 9 0 11-6.219-8.56"/>
                    </svg>
                    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                  </span>
                ) : <span style={{ position: 'relative', zIndex: 2 }}>Search</span>}
              </button>
            </div>
          </div>

          {!hasSearched && (
            <div style={{ marginTop: '20px', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {[...EXAMPLE_QUERIES, ...SAFE_DEMO_SEARCHES].filter((q, index, arr) => arr.indexOf(q) === index).map(q => (
                <button
                  key={q}
                  className="demo-pill"
                  onClick={() => handleSearch(q)}
                  style={{
                    background: 'var(--search-bg)',
                    border: '1px solid var(--panel-border)',
                    color: 'var(--soft-text)',
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
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--search-bg)'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--panel-border)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--soft-text)'
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          </div>
        </div>

        {hasSearched && (
          <div>
            {result && !result.error && result.query_parsed && (
              <div
                className="intent-banner"
                style={{
                  background: result.fitment_status === 'demo_fallback' ? 'rgba(245,158,11,0.10)' : 'rgba(220,38,38,0.08)',
                  border: `1px solid ${result.fitment_status === 'demo_fallback' ? 'rgba(245,158,11,0.24)' : 'rgba(220,38,38,0.15)'}`,
                  borderRadius: '14px',
                  padding: '12px 16px',
                  marginBottom: '24px',
                  fontSize: '13px',
                  color: result.fitment_status === 'demo_fallback' ? '#fcd34d' : '#fca5a5',
                  display: 'flex',
                  gap: '16px',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                <span style={{ color: '#fff', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 11 }}>
                  {result.fitment_status === 'exact' ? 'Fitment demo match' : result.fitment_status === 'demo_fallback' ? 'Demo-safe fallback' : 'Catalog search'}
                </span>
                {result.query_parsed.vehicle && (
                  <span>{result.query_parsed.vehicle.year} {result.query_parsed.vehicle.make} {result.query_parsed.vehicle.model}</span>
                )}
                {result.query_parsed.wheelModel && <span>Model: {result.query_parsed.wheelModel}</span>}
                {result.query_parsed.size && <span>Size: {result.query_parsed.size}&quot;</span>}
                {result.query_parsed.finish && <span>Finish: {result.query_parsed.finish}</span>}
                {result.query_parsed.boltPattern && <span>Bolt: {result.query_parsed.boltPattern}</span>}
                {result.query_parsed.brand && <span>Brand: {result.query_parsed.brand}</span>}
                {result.matched_bolt_patterns && result.matched_bolt_patterns.length > 0 && <span>Bolt data: {result.matched_bolt_patterns.join(', ')}</span>}
                <span style={{ marginLeft: 'auto', color: '#aaa' }}>{result.total} result{result.total !== 1 ? 's' : ''}</span>
              </div>
            )}

            {result?.notice && (
              <div className="intent-banner" style={{ margin: '-10px 0 24px', padding: '12px 14px', borderRadius: 12, background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', color: 'var(--muted-text)', fontSize: 13, lineHeight: 1.5 }}>
                {result.notice}
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
                <div style={{ marginTop: 18, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {(result.suggested_queries || SAFE_DEMO_SEARCHES).map(q => (
                    <button key={q} className="demo-pill" onClick={() => handleSearch(q)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--panel-border)', color: '#ddd', borderRadius: 999, padding: '8px 13px', cursor: 'pointer' }}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!loading && result && result.wheels.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', paddingBottom: '60px' }}>
                {result.wheels.map(wheel => (
                  <WheelCard key={wheel.id} wheel={wheel} themeMode={themeMode} />
                ))}
              </div>
            )}
          </div>
        )}
          </>
        ) : (
          <TireSearchPanel themeMode={themeMode} />
        )}
      </main>
    </div>
    </>
  )
}
