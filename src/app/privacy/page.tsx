import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | TIS Dealer Tool',
  description: 'Privacy policy for the TIS Dealer Tool and SMS Assistant.',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#050506] px-6 py-12 text-zinc-100">
      <article className="mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30 md:p-10">
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-red-300">TIS Dealer Tool</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-white">Privacy Policy</h1>
        <p className="mt-3 text-sm text-zinc-400">Effective date: May 1, 2026</p>

        <div className="mt-8 space-y-7 leading-7 text-zinc-300">
          <section>
            <h2 className="text-xl font-black text-white">Overview</h2>
            <p className="mt-2">
              The TIS Dealer Tool and TIS SMS Assistant help authorized dealers search TIS wheel fitment, inventory, pricing, product specifications, and ATD product links. This policy explains what information is collected and how it is used.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Information we collect</h2>
            <ul className="mt-2 list-disc space-y-2 pl-6">
              <li>SMS details such as phone number, message content, timestamps, and opt-in/opt-out status.</li>
              <li>Dealer requests, including vehicle year, make, model, wheel size, finish preferences, and selected products.</li>
              <li>Email addresses provided by users for sending wheel cards, product details, pricing, stock information, and ATD links.</li>
              <li>Basic technical information such as server logs and error logs used to operate and secure the service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">How we use information</h2>
            <ul className="mt-2 list-disc space-y-2 pl-6">
              <li>To respond to dealer SMS requests.</li>
              <li>To provide wheel fitment, stock, pricing, specifications, and ATD product links.</li>
              <li>To send requested wheel-card packages by email.</li>
              <li>To troubleshoot, secure, and improve the TIS Dealer Tool and SMS Assistant.</li>
              <li>To comply with SMS carrier requirements, including STOP, START, and HELP handling.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">SMS consent and sharing</h2>
            <p className="mt-2">
              SMS consent is used only to send messages related to the TIS Dealer Tool and TIS SMS Assistant. SMS opt-in data and consent are not sold, rented, or shared with third parties for their marketing purposes. Mobile information will not be shared with third parties or affiliates for marketing or promotional purposes. Information may be shared with service providers only as needed to operate the messaging service, such as SMS delivery providers and hosting providers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Opt out</h2>
            <p className="mt-2">
              Users can reply STOP to opt out of SMS messages at any time. Users can reply START to resume messages and HELP for help.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Contact</h2>
            <p className="mt-2">
              For privacy questions, contact the TIS Dealer Tool team through your normal TIS or ATD account representative.
            </p>
          </section>
        </div>
      </article>
    </main>
  )
}
