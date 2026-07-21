import type { Metadata } from 'next'
import { Fraunces, IBM_Plex_Mono, Source_Sans_3 } from 'next/font/google'
import './globals.css'

const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
})

const sans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-sans',
})

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'BNZA QC Uniswap tools',
  description:
    'Read-only Base Uniswap V3 helpers for QC: LP position lookup and swap route quotes.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body
        style={
          {
            '--display': 'var(--font-display)',
            '--sans': 'var(--font-sans)',
            '--mono': 'var(--font-mono)',
          } as React.CSSProperties
        }
      >
        {children}
      </body>
    </html>
  )
}
