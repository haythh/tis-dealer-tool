'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { preorderOffroadWheels } from '@/data/preorder-offroad-wheels'
import { preorderWheels, type PreorderWheel } from '@/data/preorder-wheels'

const SIZES = ['20"', '22"', '24"', '26"'] as const
const WIDTHS = ['9"', '10"', '12"', '14"'] as const
const LUG_PATTERNS = ['5x112', '5x114.3', '5x120', '5x127', '5x150', '6x135', '6x139.7', '8x170', '8x180'] as const
const QUANTITIES = [4, 8, 12, 16, 20, 24, 28, 32] as const
const PREORDER_CATEGORIES = [
  { id: 'motorsports', label: 'TIS MOTORSPORTS FORGED', wheels: preorderWheels },
  { id: 'offroad', label: 'TIS OFFROAD FORGED', wheels: preorderOffroadWheels },
] as const
const allPreorderWheels = [...preorderWheels, ...preorderOffroadWheels]
const SUCCESS_MESSAGE = 'Thank You! Your order has been submitted and an ATD representative will contact you soon.'

const PRICE_BY_SIZE: Record<(typeof SIZES)[number], number> = {
  '20"': 300,
  '22"': 340,
  '24"': 380,
  '26"': 420,
}

type WheelSelection = {
  size: string
  width: string
  lugPattern: string
  quantity: string
}

type OrderItem = {
  id: string
  wheelId: string
  wheelName: string
  category: PreorderWheel['category']
  image: string
  size: string
  width: string
  lugPattern: string
  quantity: number
  unitPrice: number
  total: number
}

type CheckoutForm = {
  name: string
  companyName: string
  address: string
  phone: string
  email: string
}

const emptySelection: WheelSelection = {
  size: '',
  width: '',
  lugPattern: '',
  quantity: '',
}

const emptyCheckoutForm: CheckoutForm = {
  name: '',
  companyName: '',
  address: '',
  phone: '',
  email: '',
}

function dollars(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

function unitPriceFor(size: string) {
  return PRICE_BY_SIZE[size as keyof typeof PRICE_BY_SIZE] ?? 0
}

function SelectField({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  options: readonly (string | number)[]
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <label className="preorder-field">
      <span>{label}</span>
      <select value={value} onChange={event => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function PreorderCard({
  wheel,
  selection,
  onSelectionChange,
  onAdd,
  onImageOpen,
}: {
  wheel: PreorderWheel
  selection: WheelSelection
  onSelectionChange: (wheelId: string, patch: Partial<WheelSelection>) => void
  onAdd: (wheel: PreorderWheel, selection: WheelSelection) => void
  onImageOpen: (wheel: PreorderWheel) => void
}) {
  const quantity = Number(selection.quantity)
  const unitPrice = unitPriceFor(selection.size)
  const total = unitPrice * quantity
  const isComplete = Boolean(selection.size && selection.width && selection.lugPattern && selection.quantity)

  return (
    <article className="preorder-card">
      <button className="image-shell image-button" type="button" onClick={() => onImageOpen(wheel)} aria-label={`View larger image of ${wheel.code}`}>
        <img src={wheel.image} alt={`${wheel.code} ${wheel.name} wheel preorder style`} loading="lazy" />
      </button>
      <div className="card-copy">
        <div>
          <p className="eyebrow">New style</p>
          <h2>{wheel.code}</h2>
          <p className="style-name">{wheel.category}</p>
        </div>
        <div className="selectors">
          <SelectField label="Wheel size" value={selection.size} options={SIZES} placeholder="Select size" onChange={size => onSelectionChange(wheel.id, { size })} />
          <SelectField label="Width" value={selection.width} options={WIDTHS} placeholder="Select width" onChange={width => onSelectionChange(wheel.id, { width })} />
          <SelectField label="Lug pattern" value={selection.lugPattern} options={LUG_PATTERNS} placeholder="Select lug" onChange={lugPattern => onSelectionChange(wheel.id, { lugPattern })} />
          <SelectField label="Quantity" value={selection.quantity} options={QUANTITIES} placeholder="Select qty" onChange={quantity => onSelectionChange(wheel.id, { quantity })} />
        </div>
        <div className="card-footer">
          <div>
            <span className="price-label">Estimated total</span>
            <strong>{isComplete ? dollars(total) : 'Select options'}</strong>
            {selection.size && <small>{dollars(unitPrice)} / wheel</small>}
          </div>
          <button type="button" disabled={!isComplete} onClick={() => onAdd(wheel, selection)}>
            Add to Order
          </button>
        </div>
      </div>
    </article>
  )
}

export default function PreorderPage() {
  const [activeCategoryId, setActiveCategoryId] = useState<(typeof PREORDER_CATEGORIES)[number]['id']>('motorsports')
  const [selections, setSelections] = useState<Record<string, WheelSelection>>({})
  const [order, setOrder] = useState<OrderItem[]>([])
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>(emptyCheckoutForm)
  const [checkoutStatus, setCheckoutStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [checkoutMessage, setCheckoutMessage] = useState('')
  const [lightboxWheel, setLightboxWheel] = useState<PreorderWheel | null>(null)

  const activeCategory = PREORDER_CATEGORIES.find(category => category.id === activeCategoryId) ?? PREORDER_CATEGORIES[0]
  const visibleWheels = activeCategory.wheels
  const grandTotal = useMemo(() => order.reduce((sum, item) => sum + item.total, 0), [order])

  useEffect(() => {
    if (!lightboxWheel) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightboxWheel(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxWheel])

  const updateSelection = (wheelId: string, patch: Partial<WheelSelection>) => {
    setSelections(current => ({
      ...current,
      [wheelId]: { ...(current[wheelId] ?? emptySelection), ...patch },
    }))
  }

  const updateCheckoutForm = (field: keyof CheckoutForm, value: string) => {
    setCheckoutForm(current => ({ ...current, [field]: value }))
  }

  const addToOrder = (wheel: PreorderWheel, selection: WheelSelection) => {
    if (!selection.size || !selection.width || !selection.lugPattern || !selection.quantity) return

    const quantity = Number(selection.quantity)
    const unitPrice = unitPriceFor(selection.size)

    setCheckoutStatus('idle')
    setCheckoutMessage('')
    setOrder(current => [
      ...current,
      {
        id: `${wheel.id}-${Date.now()}-${current.length}`,
        wheelId: wheel.id,
        wheelName: wheel.code,
        category: wheel.category,
        image: wheel.image,
        size: selection.size,
        width: selection.width,
        lugPattern: selection.lugPattern,
        quantity,
        unitPrice,
        total: unitPrice * quantity,
      },
    ])
  }

  const submitCheckout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!order.length || checkoutStatus === 'submitting') return

    const requiredFields: (keyof CheckoutForm)[] = ['name', 'companyName', 'address', 'phone', 'email']
    const missingField = requiredFields.find(field => !checkoutForm[field].trim())
    if (missingField) {
      setCheckoutStatus('error')
      setCheckoutMessage('Please fill out every checkout field before submitting.')
      return
    }

    setCheckoutStatus('submitting')
    setCheckoutMessage('')

    try {
      const response = await fetch('/api/preorder/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retailer: checkoutForm, items: order }),
      })
      const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string }

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Checkout submission failed. Please try again.')
      }

      setCheckoutStatus('success')
      setCheckoutMessage(SUCCESS_MESSAGE)
      setOrder([])
      setCheckoutOpen(false)
      setCheckoutForm(emptyCheckoutForm)
    } catch (error) {
      setCheckoutStatus('error')
      setCheckoutMessage(error instanceof Error ? error.message : 'Checkout submission failed. Please try again.')
    }
  }

  return (
    <div className="preorder-page">
      <style>{`
        .preorder-page {
          min-height: 100vh;
          color: #f7f7f8;
          background:
            radial-gradient(circle at 12% 8%, rgba(255, 255, 255, 0.14), transparent 32%),
            radial-gradient(circle at 88% 18%, rgba(24, 24, 27, 0.18), transparent 30%),
            linear-gradient(180deg, #71717a 0%, #52525b 48%, #3f3f46 100%);
        }

        .preorder-page::before {
          content: '';
          position: fixed;
          inset: 0;
          pointer-events: none;
          opacity: 0.2;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.055) 1px, transparent 1px);
          background-size: 58px 58px;
          mask-image: linear-gradient(to bottom, black, transparent 76%);
        }

        header,
        main {
          position: relative;
          z-index: 1;
        }

        header {
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(5, 5, 5, 0.76);
          backdrop-filter: blur(14px);
          padding: 16px 24px;
        }

        .header-inner {
          align-items: center;
          display: flex;
          gap: 16px;
          justify-content: space-between;
          margin: 0 auto;
          max-width: 1280px;
        }

        .brand-lockup {
          align-items: center;
          color: #fff;
          display: inline-flex;
          gap: 12px;
          text-decoration: none;
        }

        .brand-lockup img {
          height: 28px;
          width: auto;
        }

        .brand-lockup span {
          border-left: 1px solid rgba(255, 255, 255, 0.14);
          color: #d8d8dc;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          padding-left: 12px;
          text-transform: uppercase;
        }

        .back-link {
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          color: #f4f4f5;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.08em;
          padding: 9px 13px;
          text-decoration: none;
          text-transform: uppercase;
        }

        main {
          margin: 0 auto;
          max-width: 1280px;
          padding: 54px 24px 72px;
        }

        .hero {
          display: grid;
          gap: 24px;
          grid-template-columns: minmax(0, 1fr) 360px;
          margin-bottom: 34px;
        }

        .hero-card,
        .summary {
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid rgba(255, 255, 255, 0.09);
          box-shadow: 0 18px 70px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(16px);
        }

        .hero-card {
          border-radius: 28px;
          overflow: hidden;
          padding: clamp(28px, 5vw, 52px);
        }

        .badge,
        .eyebrow {
          color: #fecaca;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.12em;
          margin: 0;
          text-transform: uppercase;
        }

        h1 {
          font-size: clamp(42px, 7vw, 86px);
          font-weight: 950;
          letter-spacing: -0.04em;
          line-height: 0.92;
          margin: 14px 0 18px;
          max-width: 860px;
          text-transform: uppercase;
        }

        .hero-card p:not(.badge) {
          color: #c8c8cf;
          font-size: 18px;
          line-height: 1.6;
          margin: 0;
          max-width: 760px;
        }

        .hero-stats {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          margin-top: 28px;
        }

        .hero-stats div {
          background: rgba(0, 0, 0, 0.24);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 14px;
        }

        .hero-stats strong {
          display: block;
          font-size: 24px;
        }

        .hero-stats span {
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .summary {
          align-self: start;
          border-radius: 24px;
          padding: 22px;
          position: sticky;
          top: 18px;
        }

        .summary h2 {
          font-size: 22px;
          margin: 0 0 6px;
          text-transform: uppercase;
        }

        .summary-note {
          color: #a1a1aa;
          font-size: 13px;
          line-height: 1.5;
          margin: 0 0 18px;
        }

        .empty-cart {
          border: 1px dashed rgba(255, 255, 255, 0.16);
          border-radius: 16px;
          color: #b9b9c0;
          font-size: 14px;
          line-height: 1.5;
          padding: 18px;
        }

        .order-list {
          display: grid;
          gap: 12px;
        }

        .order-item {
          align-items: center;
          background: rgba(0, 0, 0, 0.22);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          display: grid;
          gap: 12px;
          grid-template-columns: 58px 1fr auto;
          padding: 10px;
        }

        .order-item img {
          aspect-ratio: 1;
          background: #fff;
          border-radius: 12px;
          object-fit: contain;
          width: 58px;
        }

        .order-item h3 {
          font-size: 14px;
          margin: 0 0 4px;
        }

        .order-item p {
          color: #a1a1aa;
          font-size: 12px;
          line-height: 1.45;
          margin: 0;
        }

        .checkout-button {
          background: #dc2626;
          border: 0;
          border-radius: 12px;
          color: #fff;
          cursor: pointer;
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 0.08em;
          margin-top: 16px;
          padding: 13px 16px;
          text-transform: uppercase;
          width: 100%;
        }

        .checkout-button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .checkout-form {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 18px;
          display: grid;
          gap: 12px;
          margin-top: 16px;
          padding: 14px;
        }

        .checkout-form h3 {
          font-size: 15px;
          letter-spacing: 0.08em;
          margin: 0;
          text-transform: uppercase;
        }

        .checkout-field {
          display: grid;
          gap: 6px;
        }

        .checkout-field span {
          color: #d4d4d8;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .checkout-field input,
        .checkout-field textarea {
          background: #ffffff;
          border: 1px solid rgba(15, 15, 18, 0.12);
          border-radius: 10px;
          color: #18181b;
          font: inherit;
          font-size: 14px;
          font-weight: 650;
          padding: 11px 12px;
          width: 100%;
        }

        .checkout-field textarea {
          min-height: 76px;
          resize: vertical;
        }

        .checkout-actions {
          display: grid;
          gap: 8px;
          grid-template-columns: 1fr 1fr;
        }

        .checkout-submit,
        .checkout-cancel {
          border-radius: 10px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.08em;
          padding: 11px 12px;
          text-transform: uppercase;
        }

        .checkout-submit {
          background: #dc2626;
          border: 0;
          color: #fff;
        }

        .checkout-cancel {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.16);
          color: #fff;
        }

        .checkout-submit:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .checkout-message {
          border-radius: 14px;
          font-size: 13px;
          font-weight: 800;
          line-height: 1.45;
          margin-top: 14px;
          padding: 12px;
        }

        .checkout-message.success {
          background: rgba(34, 197, 94, 0.14);
          border: 1px solid rgba(74, 222, 128, 0.3);
          color: #bbf7d0;
        }

        .checkout-message.error {
          background: rgba(220, 38, 38, 0.16);
          border: 1px solid rgba(248, 113, 113, 0.32);
          color: #fecaca;
        }

        .remove-button {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          color: #fff;
          cursor: pointer;
          font-size: 12px;
          font-weight: 900;
          padding: 8px 10px;
        }

        .grand-total {
          align-items: baseline;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          justify-content: space-between;
          margin-top: 18px;
          padding-top: 16px;
        }

        .grand-total span {
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .grand-total strong {
          color: #fff;
          font-size: 28px;
        }

        .category-tabs {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin: 0 0 20px;
        }

        .category-tabs button {
          align-items: center;
          background: rgba(255, 255, 255, 0.055);
          border: 1px solid rgba(255, 255, 255, 0.11);
          border-radius: 18px;
          color: #d4d4d8;
          cursor: pointer;
          display: flex;
          font-size: 13px;
          font-weight: 950;
          justify-content: space-between;
          letter-spacing: 0.08em;
          padding: 16px 18px;
          text-align: left;
          text-transform: uppercase;
          transition: background 180ms ease, border-color 180ms ease, color 180ms ease, transform 180ms ease;
        }

        .category-tabs button:hover,
        .category-tabs button.active {
          background: #ffffff;
          border-color: rgba(220, 38, 38, 0.6);
          color: #111113;
          transform: translateY(-1px);
        }

        .category-tabs strong {
          background: #dc2626;
          border-radius: 999px;
          color: #ffffff;
          font-size: 12px;
          padding: 5px 9px;
        }

        .grid {
          display: grid;
          gap: 18px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .preorder-card {
          background: #ffffff;
          border: 1px solid rgba(15, 15, 18, 0.1);
          border-radius: 12px;
          box-shadow: 0 20px 50px rgba(15, 15, 18, 0.08);
          color: #111113;
          display: flex;
          flex-direction: column;
          min-width: 0;
          overflow: hidden;
          position: relative;
          transition: border-color 180ms ease, box-shadow 220ms ease, transform 220ms ease;
        }

        .preorder-card:hover {
          border-color: rgba(220, 38, 38, 0.4);
          box-shadow: 0 28px 80px rgba(220, 38, 38, 0.12);
          transform: translateY(-2px);
        }

        .image-shell {
          align-items: center;
          background: #f4f4f5;
          display: flex;
          height: 380px;
          justify-content: center;
          padding: 12px;
          position: relative;
        }

        .image-button {
          border: 0;
          cursor: zoom-in;
          width: 100%;
        }

        .image-button:focus-visible {
          outline: 3px solid rgba(220, 38, 38, 0.55);
          outline-offset: -3px;
        }

        .image-shell img {
          filter: drop-shadow(0 18px 24px rgba(0, 0, 0, 0.24));
          height: 100%;
          max-width: 100%;
          object-fit: contain;
          width: 100%;
        }

        .card-copy {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 14px;
          padding: 16px;
        }

        .card-copy .eyebrow {
          color: #991b1b;
        }

        .card-copy h2 {
          color: #111113;
          font-size: 21px;
          font-weight: 800;
          letter-spacing: 0;
          line-height: 1.3;
          margin: 4px 0 0;
          text-transform: uppercase;
        }

        .style-name {
          color: #991b1b;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.08em;
          margin: 0 0 2px;
        }

        .selectors {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .preorder-field {
          background: #f5f5f6;
          border-radius: 6px;
          display: grid;
          gap: 4px;
          padding: 6px 8px 8px;
        }

        .preorder-field span {
          color: #74747b;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        select {
          appearance: none;
          background: #ffffff;
          border: 1px solid rgba(15, 15, 18, 0.1);
          border-radius: 8px;
          color: #242428;
          cursor: pointer;
          font-size: 13px;
          font-weight: 700;
          min-width: 0;
          outline: none;
          padding: 8px 10px;
          width: 100%;
        }

        select:focus {
          border-color: rgba(220, 38, 38, 0.82);
          box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.18);
        }

        .card-footer {
          align-items: end;
          display: flex;
          gap: 12px;
          justify-content: space-between;
          margin-top: auto;
        }

        .price-label,
        .card-footer small {
          color: #52525b;
          display: block;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .card-footer strong {
          color: #111113;
          display: block;
          font-size: 18px;
          font-weight: 800;
          margin: 2px 0;
        }

        .card-footer button {
          background: #dc2626;
          border: 0;
          border-radius: 8px;
          box-shadow: none;
          color: #fff;
          cursor: pointer;
          font-size: 14px;
          font-weight: 800;
          padding: 10px 16px;
          text-transform: uppercase;
          transition: background 160ms ease, opacity 160ms ease, transform 160ms ease;
          white-space: nowrap;
        }

        .card-footer button:hover:not(:disabled) {
          background: #ef4444;
          transform: translateY(-1px);
        }

        .card-footer button:disabled {
          cursor: not-allowed;
          opacity: 0.42;
        }

        .lightbox-backdrop {
          align-items: center;
          background: rgba(9, 9, 11, 0.78);
          backdrop-filter: blur(18px);
          display: flex;
          inset: 0;
          justify-content: center;
          padding: 24px;
          position: fixed;
          z-index: 20;
        }

        .lightbox-panel {
          background: #f4f4f5;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 24px;
          box-shadow: 0 30px 120px rgba(0, 0, 0, 0.48);
          color: #111113;
          max-width: min(920px, 94vw);
          overflow: hidden;
          position: relative;
          width: 100%;
        }

        .lightbox-close {
          background: rgba(17, 17, 19, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 999px;
          color: #fff;
          cursor: pointer;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.08em;
          padding: 10px 13px;
          position: absolute;
          right: 16px;
          text-transform: uppercase;
          top: 16px;
          z-index: 1;
        }

        .lightbox-panel img {
          aspect-ratio: 1.25;
          display: block;
          object-fit: contain;
          padding: clamp(28px, 5vw, 56px);
          width: 100%;
        }

        .lightbox-caption {
          background: #fff;
          border-top: 1px solid rgba(15, 15, 18, 0.08);
          padding: 16px 20px;
        }

        .lightbox-caption h2 {
          font-size: 22px;
          margin: 0;
          text-transform: uppercase;
        }

        .lightbox-caption p {
          color: #71717a;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.08em;
          margin: 4px 0 0;
          text-transform: uppercase;
        }

        @media (max-width: 1100px) {
          .hero {
            grid-template-columns: 1fr;
          }

          .summary {
            position: static;
          }

          .grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 680px) {
          header {
            padding: 14px 16px;
          }

          .header-inner,
          .card-footer {
            align-items: stretch;
            flex-direction: column;
          }

          main {
            padding: 34px 16px 56px;
          }

          .category-tabs,
          .hero-stats,
          .grid,
          .selectors {
            grid-template-columns: 1fr;
          }

          .brand-lockup span {
            display: none;
          }

          .card-footer button {
            width: 100%;
          }
        }
      `}</style>

      <header>
        <div className="header-inner">
          <a className="brand-lockup" href="/">
            <img src="/tis-logo.png" alt="TIS" />
            <span>Dealer preorder</span>
          </a>
          <a className="back-link" href="/">
            Back to Search
          </a>
        </div>
      </header>

      <main>
        <section className="hero" aria-label="New TIS Wheel Preorder">
          <div className="hero-card">
            <p className="badge">Retailer commitment preview</p>
            <h1>TIS Forged Preorder</h1>
            <p>
              Review upcoming wheel styles, choose a size package, and build a no-pressure preorder summary for retailer commitments. Pricing starts at $300 per wheel for 20&quot; and steps up $40 per diameter.
            </p>
            <div className="hero-stats">
              <div>
                <strong>{allPreorderWheels.length}</strong>
                <span>New styles</span>
              </div>
              <div>
                <strong>$300+</strong>
                <span>Per wheel</span>
              </div>
              <div>
                <strong>4x</strong>
                <span>Qty increments</span>
              </div>
            </div>
          </div>

          <aside className="summary" aria-label="Order summary">
            <h2>Order Summary</h2>
            <p className="summary-note">Add configured styles here, then submit checkout to send the preorder request to TIS.</p>
            {order.length === 0 ? (
              <div className="empty-cart">No styles added yet. Select all options on any wheel card to unlock Add to Order.</div>
            ) : (
              <>
                <div className="order-list">
                  {order.map(item => (
                    <div className="order-item" key={item.id}>
                      <img src={item.image} alt="" />
                      <div>
                        <h3>{item.wheelName}</h3>
                        <p>
                          {item.category}<br />
                          {item.size} × {item.width} · {item.lugPattern}<br />
                          Qty {item.quantity} · {dollars(item.unitPrice)} ea · {dollars(item.total)}
                        </p>
                      </div>
                      <button className="remove-button" type="button" onClick={() => setOrder(current => current.filter(orderItem => orderItem.id !== item.id))}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <div className="grand-total">
                  <span>Grand total</span>
                  <strong>{dollars(grandTotal)}</strong>
                </div>
                <button className="checkout-button" type="button" disabled={!order.length} onClick={() => setCheckoutOpen(open => !open)}>
                  Checkout
                </button>
                {checkoutOpen && (
                  <form className="checkout-form" onSubmit={submitCheckout}>
                    <h3>Retailer details</h3>
                    <label className="checkout-field">
                      <span>Name</span>
                      <input required value={checkoutForm.name} onChange={event => updateCheckoutForm('name', event.target.value)} />
                    </label>
                    <label className="checkout-field">
                      <span>Company Name</span>
                      <input required value={checkoutForm.companyName} onChange={event => updateCheckoutForm('companyName', event.target.value)} />
                    </label>
                    <label className="checkout-field">
                      <span>Address</span>
                      <textarea required value={checkoutForm.address} onChange={event => updateCheckoutForm('address', event.target.value)} />
                    </label>
                    <label className="checkout-field">
                      <span>Phone</span>
                      <input required type="tel" value={checkoutForm.phone} onChange={event => updateCheckoutForm('phone', event.target.value)} />
                    </label>
                    <label className="checkout-field">
                      <span>Email</span>
                      <input required type="email" value={checkoutForm.email} onChange={event => updateCheckoutForm('email', event.target.value)} />
                    </label>
                    <div className="checkout-actions">
                      <button className="checkout-cancel" type="button" onClick={() => setCheckoutOpen(false)}>
                        Cancel
                      </button>
                      <button className="checkout-submit" type="submit" disabled={checkoutStatus === 'submitting'}>
                        {checkoutStatus === 'submitting' ? 'Submitting...' : 'Submit Order'}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
            {checkoutMessage && (
              <div className={`checkout-message ${checkoutStatus === 'success' ? 'success' : 'error'}`}>
                {checkoutMessage}
              </div>
            )}
          </aside>
        </section>

        <section className="category-tabs" aria-label="Preorder categories">
          {PREORDER_CATEGORIES.map(category => (
            <button
              key={category.id}
              type="button"
              className={category.id === activeCategoryId ? 'active' : ''}
              aria-pressed={category.id === activeCategoryId}
              onClick={() => setActiveCategoryId(category.id)}
            >
              <span>{category.label}</span>
              <strong>{category.wheels.length}</strong>
            </button>
          ))}
        </section>

        <section className="grid" aria-label={`${activeCategory.label} preorder wheel styles`}>
          {visibleWheels.map(wheel => (
            <PreorderCard
              key={wheel.id}
              wheel={wheel}
              selection={selections[wheel.id] ?? emptySelection}
              onSelectionChange={updateSelection}
              onAdd={addToOrder}
              onImageOpen={setLightboxWheel}
            />
          ))}
        </section>
      </main>

      {lightboxWheel && (
        <div className="lightbox-backdrop" role="presentation" onClick={() => setLightboxWheel(null)}>
          <div className="lightbox-panel" role="dialog" aria-modal="true" aria-label={`${lightboxWheel.code} enlarged wheel image`} onClick={event => event.stopPropagation()}>
            <button className="lightbox-close" type="button" onClick={() => setLightboxWheel(null)}>
              Close
            </button>
            <img src={lightboxWheel.image} alt={`${lightboxWheel.code} ${lightboxWheel.name} wheel enlarged`} />
            <div className="lightbox-caption">
              <h2>{lightboxWheel.code}</h2>
              <p>{lightboxWheel.category}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
