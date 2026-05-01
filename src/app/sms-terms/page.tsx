import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SMS Terms | TIS Dealer Tool',
  description: 'SMS terms for the TIS SMS Assistant.',
}

export default function SmsTermsPage() {
  return (
    <main className="min-h-screen bg-[#050506] px-6 py-12 text-zinc-100">
      <article className="mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30 md:p-10">
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-red-300">TIS SMS Assistant</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-white">SMS Terms</h1>
        <p className="mt-3 text-sm text-zinc-400">Effective date: May 1, 2026</p>

        <div className="mt-8 space-y-7 leading-7 text-zinc-300">
          <section>
            <h2 className="text-xl font-black text-white">Program description</h2>
            <p className="mt-2">
              The TIS SMS Assistant allows authorized dealer representatives to text questions about TIS wheel fitment, inventory, pricing, product specifications, and ATD product links. Messages are conversational and are sent in response to dealer requests.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Consent</h2>
            <p className="mt-2">
              By texting the TIS SMS Assistant number or requesting access through the TIS Dealer Tool, users agree to receive conversational SMS messages related to their dealer support and product-search requests. Consent is not a condition of purchase.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Message frequency and rates</h2>
            <p className="mt-2">
              Message frequency varies based on user requests. Message and data rates may apply.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Opt out and help</h2>
            <p className="mt-2">
              Reply STOP to opt out at any time. Reply START to resume messages. Reply HELP for help.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Privacy</h2>
            <p className="mt-2">
              See the Privacy Policy at <a className="font-bold text-red-300 underline" href="/privacy">https://inventory.teamtis.com/privacy</a>.
            </p>
          </section>
        </div>
      </article>
    </main>
  )
}
