import type { Metadata } from 'next'
import { Chakra_Petch } from 'next/font/google'
import './globals.css'

const chakraPetch = Chakra_Petch({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-chakra-petch',
})

export const metadata: Metadata = {
  title: 'TIS Wheel Search',
  description: 'Find TIS wheels by vehicle fitment. Search by year/make/model and get direct ATDOnline links.',
  keywords: 'TIS wheels, dealer tool, wheel fitment, ATDOnline, aftermarket wheels',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={chakraPetch.variable}>
      <body className={`${chakraPetch.className} antialiased`}>
        {children}
      </body>
    </html>
  )
}
