import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

type DbWheelRow = {
  id: number
  supplier_pn: string
  brand: string
  model: string
  size: string | null
  ta_images_json: string | null
}

type ToughAsset = {
  id: string
  originalName: string
  mimeType: string
  kind: string | null
  categoryName: string | null
  tags?: string[]
  thumbUrl?: string
}

export type CoverageModelRow = {
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

export type CoverageSummary = {
  totalWheelSkus: number
  skusWithToughAssetsImages: number
  skusMissingToughAssetsImages: number
  totalToughAssetsImagesAvailable: number
  modelsWithVideo: number
}

export type CoverageResponse = {
  summary: CoverageSummary
  models: CoverageModelRow[]
  missing: CoverageModelRow[]
  generatedAt: string
}

function normalizeModel(value: string | null | undefined) {
  return (value || '').trim().toLowerCase()
}

function normalizeSize(value: string | null | undefined) {
  return (value || '').trim().toLowerCase().replace(/\s+/g, '')
}

function displaySize(value: string | null | undefined) {
  return (value || '').trim().toUpperCase()
}

function parseDbImages(value: string | null | undefined) {
  if (!value) return [] as Array<{ type?: string }>
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function detectImageType(asset: ToughAsset) {
  const haystack = `${asset.originalName || ''} ${(asset.tags || []).join(' ')} ${asset.kind || ''} ${asset.categoryName || ''}`.toLowerCase()
  if (haystack.includes('topangle') || haystack.includes('top-angle') || haystack.includes('top angle')) return 'topangle'
  if (haystack.includes('angle')) return 'angle'
  if (haystack.includes('face')) return 'face'
  if (asset.mimeType?.startsWith('video/') || asset.kind === 'video' || (asset.categoryName || '').toLowerCase().includes('video')) return 'video'
  return 'other'
}

function extractModelTag(asset: ToughAsset) {
  return (asset.tags || []).find(tag => /^[a-z0-9]+$/i.test(tag) && /\d/.test(tag) && !tag.toLowerCase().startsWith('brand:')) || null
}

function extractSizeTags(asset: ToughAsset) {
  return (asset.tags || []).filter(tag => /^\d{2,3}x\d{1,2}(\.\d+)?$/i.test(tag.trim()))
}

export async function getCoverageReport(): Promise<CoverageResponse> {
  const db = getDb()
  const wheels = db.prepare(`SELECT id, supplier_pn, brand, model, size, ta_images_json FROM wheels ORDER BY brand, model, size`).all() as DbWheelRow[]

  const totalWheelSkus = wheels.length
  const skusWithToughAssetsImages = wheels.filter(row => parseDbImages(row.ta_images_json).length > 0).length
  const skusMissingToughAssetsImages = totalWheelSkus - skusWithToughAssetsImages

  const response = await fetch('https://toughassets.com/api/public/tis/assets', {
    headers: {
      accept: 'application/json',
      'user-agent': 'Mozilla/5.0',
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ToughAssets (${response.status})`)
  }

  const json = await response.json() as { assets?: ToughAsset[] }
  const assets = Array.isArray(json.assets) ? json.assets : []

  const modelMap = new Map<string, {
    model: string
    brand: string
    sizesInCatalog: Set<string>
    liveImageCount: number
    dbImageCount: number
    hasFace: boolean
    hasAngle: boolean
    hasTopAngle: boolean
    hasVideo: boolean
    sizeTags: Set<string>
    matchedSizes: Set<string>
  }>()

  for (const wheel of wheels) {
    const key = normalizeModel(wheel.model)
    const existing = modelMap.get(key) || {
      model: wheel.model,
      brand: wheel.brand,
      sizesInCatalog: new Set<string>(),
      liveImageCount: 0,
      dbImageCount: 0,
      hasFace: false,
      hasAngle: false,
      hasTopAngle: false,
      hasVideo: false,
      sizeTags: new Set<string>(),
      matchedSizes: new Set<string>(),
    }

    existing.sizesInCatalog.add(displaySize(wheel.size))
    existing.dbImageCount += parseDbImages(wheel.ta_images_json).length
    modelMap.set(key, existing)
  }

  for (const asset of assets) {
    const modelTag = extractModelTag(asset)
    if (!modelTag) continue

    const entry = modelMap.get(normalizeModel(modelTag))
    if (!entry) continue

    const type = detectImageType(asset)
    if (type === 'video') {
      entry.hasVideo = true
    } else {
      entry.liveImageCount += 1
      if (type === 'face') entry.hasFace = true
      if (type === 'angle') entry.hasAngle = true
      if (type === 'topangle') entry.hasTopAngle = true
    }

    for (const sizeTag of extractSizeTags(asset)) {
      const normalized = normalizeSize(sizeTag)
      entry.sizeTags.add(displaySize(sizeTag))
      entry.matchedSizes.add(normalized)
    }
  }

  const models = Array.from(modelMap.values()).map(entry => {
    const sizesInCatalog = Array.from(entry.sizesInCatalog)
    const missingSizes = sizesInCatalog.filter(size => !entry.matchedSizes.has(normalizeSize(size)))
    const hasPrimarySet = entry.hasFace && entry.hasAngle && entry.hasTopAngle
    const imageCount = Math.max(entry.liveImageCount, entry.dbImageCount)
    const status: CoverageModelRow['status'] = imageCount === 0
      ? 'Missing'
      : hasPrimarySet
        ? 'Complete'
        : 'Partial'

    return {
      model: entry.model,
      brand: entry.brand,
      sizesInCatalog: sizesInCatalog.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      imageCount,
      hasFace: entry.hasFace,
      hasAngle: entry.hasAngle,
      hasTopAngle: entry.hasTopAngle,
      hasVideo: entry.hasVideo,
      sizeTags: Array.from(entry.sizeTags).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      missingSizes: missingSizes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      status,
    }
  }).sort((a, b) => a.model.localeCompare(b.model, undefined, { numeric: true }))

  const missing = [...models].filter(model => model.status !== 'Complete' || model.missingSizes.length > 0)
    .sort((a, b) => {
      if (b.missingSizes.length !== a.missingSizes.length) return b.missingSizes.length - a.missingSizes.length
      if (a.status !== b.status) {
        const order = { Missing: 0, Partial: 1, Complete: 2 }
        return order[a.status] - order[b.status]
      }
      return a.model.localeCompare(b.model, undefined, { numeric: true })
    })

  const totalToughAssetsImagesAvailable = models.reduce((sum, model) => sum + model.imageCount, 0)
  const modelsWithVideo = models.filter(model => model.hasVideo).length

  return {
    summary: {
      totalWheelSkus,
      skusWithToughAssetsImages,
      skusMissingToughAssetsImages,
      totalToughAssetsImagesAvailable,
      modelsWithVideo,
    },
    models,
    missing,
    generatedAt: new Date().toISOString(),
  }
}
