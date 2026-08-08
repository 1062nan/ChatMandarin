import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'ChatMandarin — AI Chinese tutor for HSK learners',
    template: '%s · ChatMandarin'
  },
  description: 'The AI conversation tutor built specifically for HSK learners. Speak Mandarin from day 1 — HSK-graded conversation, HSKK mock test, real-time feedback.',
  keywords: ['learn Chinese', 'HSK', 'Mandarin', 'AI tutor', 'Chinese speaking practice', 'HSKK'],
  authors: [{ name: 'ChatMandarin' }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://chatmandarin.cc'),
  openGraph: {
    title: 'ChatMandarin — AI Chinese tutor for HSK learners',
    description: 'Speak Mandarin from day 1. HSK-graded AI conversation, HSKK mock test, real-time feedback.',
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'ChatMandarin',
    images: ['/og-image.svg']
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ChatMandarin — AI Chinese tutor for HSK learners',
    description: 'Speak Mandarin from day 1. HSK-graded AI conversation, HSKK mock test.',
    images: ['/og-image.svg']
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true }
  },
  alternates: {
    canonical: '/'
  }
}

export const viewport: Viewport = {
  themeColor: '#c23b22',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.svg" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  )
}
