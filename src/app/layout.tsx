import type { Metadata } from 'next'
import { Space_Grotesk } from 'next/font/google'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-space-grotesk',
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
    <html lang="en" className={spaceGrotesk.variable}>
      <body className={`${spaceGrotesk.className} antialiased`}>
        {children}
      </body>
    </html>
  )
}
