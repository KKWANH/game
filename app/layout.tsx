import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'Blackjack · game.kwanho.dev',
  description: '친구끼리 즐기는 실시간 블랙잭 — 가상 칩, 장부, 최종 정산까지.',
}

export const viewport: Viewport = {
  themeColor: '#0b2018',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className="dark">
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster theme="dark" position="top-center" richColors />
      </body>
    </html>
  )
}
