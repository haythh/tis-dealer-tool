'use client'

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type SmsDemoState = {
  vehicle?: { year: number | null; make: string | null; model: string | null } | null
  size?: string | null
  finish?: string | null
  brand?: string | null
  awaiting?: 'vehicle' | 'size' | 'finish' | 'email' | null
  finishPreferenceAsked?: boolean
  lastResultIds?: number[]
  email?: string | null
}

type SmsDemoCard = {
  id: number
  supplier_pn: string
  brand: string
  model: string
  color_finish: string
  size: string
  offset_mm: string
  bolt_pattern: string
  hub_bore: string
  map_price: number | null
  atd_url: string | null
  in_stock: number | null
  stock_today: number | null
  stock_tomorrow: number | null
  stock_national: number | null
  total_stock: number | null
  ta_image_url: string | null
  atd_image_url: string | null
}

type ChatMessage = {
  id: string
  role: 'rep' | 'bot'
  text: string
  cards?: SmsDemoCard[]
  resultUrl?: string
}

const STARTER = 'What 22" TIS wheels are stock for a 2022 Ford F-150?'

function currency(value: number | null) {
  return value ? `$${Math.round(value).toLocaleString()}` : 'TBD'
}

function WheelCard({ card }: { card: SmsDemoCard }) {
  const imageUrl = card.ta_image_url || card.atd_image_url

  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/20 backdrop-blur">
      <div className="relative flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-800 to-black p-4">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={`${card.brand} ${card.model}`} className="max-h-full max-w-full object-contain drop-shadow-2xl" />
        ) : (
          <div className="text-sm uppercase tracking-[0.3em] text-white/30">TIS</div>
        )}
        <span className="absolute left-4 top-4 rounded-full bg-emerald-400 px-3 py-1 text-xs font-black text-black">IN STOCK</span>
      </div>
      <div className="space-y-4 p-5">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.24em] text-red-300">{card.brand}</div>
          <h3 className="mt-1 text-2xl font-black text-white">{card.model}</h3>
          <p className="mt-1 text-sm text-zinc-300">{card.color_finish}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Spec label="Size" value={card.size} />
          <Spec label="Offset" value={card.offset_mm || '—'} />
          <Spec label="Bolt" value={card.bolt_pattern} />
          <Spec label="Hub" value={card.hub_bore || '—'} />
        </div>
        <div className="flex items-end justify-between gap-3 border-t border-white/10 pt-4">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">MAP</div>
            <div className="text-2xl font-black text-white">{currency(card.map_price)}</div>
          </div>
          <div className="text-right text-xs text-zinc-400">
            <div>{card.total_stock ?? 0} total</div>
            <div>{card.stock_today ?? 0} today · {card.stock_national ?? 0} national</div>
          </div>
        </div>
        {card.atd_url ? (
          <a href={card.atd_url} target="_blank" className="block rounded-2xl bg-red-600 px-4 py-3 text-center text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-red-500">
            Open ATD Link
          </a>
        ) : null}
      </div>
    </article>
  )
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{label}</div>
      <div className="mt-1 text-sm font-bold text-zinc-100">{value}</div>
    </div>
  )
}

function SmsDemoContent() {
  const searchParams = useSearchParams()
  const linkedResultIds = useMemo(() => searchParams.get('results')?.split(',').filter(Boolean) || [], [searchParams])
  const [input, setInput] = useState(STARTER)
  const [loading, setLoading] = useState(false)
  const [state, setState] = useState<SmsDemoState>({})
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'intro',
      role: 'bot',
      text: linkedResultIds.length
        ? `Loaded shared result package ${linkedResultIds.join(', ')}. In the live version this link opens a permanent quote page.`
        : 'Text the assistant like a dealer rep would. This demo uses Dealer Tool data now; the EDI feed plugs into the same inventory/pricing seam later.',
    },
  ])

  async function sendMessage(message = input) {
    if (!message.trim() || loading) return
    setLoading(true)
    const repMessage: ChatMessage = { id: crypto.randomUUID(), role: 'rep', text: message }
    setMessages(prev => [...prev, repMessage])
    setInput('')

    try {
      const response = await fetch('/api/sms-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, state }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Demo failed')
      setState(data.state || {})
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'bot',
          text: (data.messages || []).join('\n\n'),
          cards: data.cards,
          resultUrl: data.resultUrl,
        },
      ])
    } catch (error) {
      setMessages(prev => [
        ...prev,
        { id: crypto.randomUUID(), role: 'bot', text: error instanceof Error ? error.message : 'Something broke.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const latestCards = [...messages].reverse().find(message => message.cards?.length)?.cards || []

  return (
    <main className="min-h-screen bg-[#050506] text-white">
      <section className="relative overflow-hidden px-5 py-8 sm:px-8 lg:px-12">
        <div className="absolute left-[-10%] top-[-20%] h-96 w-96 rounded-full bg-red-600/20 blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] h-96 w-96 rounded-full bg-zinc-500/10 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="flex flex-col justify-between rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30 backdrop-blur md:p-8">
            <div>
              <div className="inline-flex rounded-full border border-red-400/30 bg-red-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-red-200">
                TIS SMS Assistant Demo
              </div>
              <h1 className="mt-6 max-w-xl text-4xl font-black tracking-tight md:text-6xl">
                Dealer Tool, rebuilt for the text thread.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
                Retail reps ask messy fitment questions. The assistant drills down, returns stocked wheel cards, then captures an email for a buy-ready ATD package.
              </p>
            </div>

            <div className="mt-10 grid gap-3 text-sm text-zinc-300 sm:grid-cols-3">
              <DemoPill label="Now" value="SQLite demo inventory" />
              <DemoPill label="Next" value="ATD EDI adapter" />
              <DemoPill label="Channel" value="Twilio SMS/MMS" />
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-zinc-950/90 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <div className="font-black">+1 (555) TIS-DEMO</div>
                <div className="text-xs text-emerald-300">online · demo mode</div>
              </div>
              <button
                onClick={() => sendMessage(STARTER)}
                className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-zinc-300 transition hover:bg-white/10"
              >
                Run sample
              </button>
            </div>

            <div className="h-[560px] space-y-4 overflow-y-auto p-5">
              {messages.map(message => (
                <div key={message.id} className={message.role === 'rep' ? 'ml-auto max-w-[82%]' : 'mr-auto max-w-[92%]'}>
                  <div className={message.role === 'rep'
                    ? 'whitespace-pre-line rounded-[1.4rem] bg-red-600 px-5 py-3 text-sm font-semibold text-white'
                    : 'whitespace-pre-line rounded-[1.4rem] border border-white/10 bg-white/[0.07] px-5 py-3 text-sm leading-6 text-zinc-100'}>
                    {message.text}
                  </div>
                  {message.resultUrl ? (
                    <a href={message.resultUrl} className="mt-2 inline-block text-xs font-bold text-red-300 underline decoration-red-300/40 underline-offset-4">
                      Open mobile wheel-card package
                    </a>
                  ) : null}
                </div>
              ))}
              {loading ? <div className="text-sm text-zinc-500">Assistant is checking fitment + stock…</div> : null}
            </div>

            <form
              onSubmit={event => {
                event.preventDefault()
                sendMessage()
              }}
              className="flex gap-3 border-t border-white/10 p-4"
            >
              <input
                value={input}
                onChange={event => setInput(event.target.value)}
                placeholder="Type an SMS message…"
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none ring-red-500/50 placeholder:text-zinc-600 focus:ring-2"
              />
              <button className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-red-100" disabled={loading}>
                Send
              </button>
            </form>
          </div>
        </div>

        {latestCards.length ? (
          <div className="relative mx-auto mt-10 max-w-7xl">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.24em] text-red-300">Generated cards</div>
                <h2 className="mt-2 text-3xl font-black">Email-ready wheel package</h2>
              </div>
              <div className="hidden text-right text-sm text-zinc-400 sm:block">Same card payload can power MMS previews, mobile quote pages, and ATD links.</div>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {latestCards.slice(0, 6).map(card => <WheelCard key={card.id} card={card} />)}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  )
}

function DemoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">{label}</div>
      <div className="mt-2 font-bold text-white">{value}</div>
    </div>
  )
}

export default function SmsDemoPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#050506] text-white" />}>
      <SmsDemoContent />
    </Suspense>
  )
}
