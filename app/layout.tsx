import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import './globals.css'
import { getLocale } from '@/lib/i18n/locale'
import { LocaleProvider } from '@/lib/i18n/provider'

export const metadata: Metadata = {
  title: 'game.kwanho.dev',
  description: 'Real-time mini-games with friends — virtual chips, ledger, settlement.',
}

export const viewport: Viewport = {
  themeColor: '#0b2018',
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  return (
    <html lang={locale} className="dark">
      <body className="min-h-dvh antialiased">
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
        <Toaster theme="dark" position="top-center" richColors />
      </body>
    </html>
  )
}
