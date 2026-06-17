import type { Metadata } from 'next'
import { Bricolage_Grotesque, DM_Sans, JetBrains_Mono } from 'next/font/google'
import { getAppUrl, isSitePublic } from '@/lib/env'
import { VercelInsights } from '@/components/VercelInsights'
import { DemoLocalBootstrap } from '@/components/app/DemoLocalBootstrap'
import '@/styles.css'

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const sans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

const sitePublic = isSitePublic()

export const metadata: Metadata = {
  title: 'Runlabs42 — Crea webs desde tu navegador',
  description:
    'Runlabs42 convierte ideas en webs listas para producción. 100% en el navegador, sin terminal ni instalaciones.',
  robots: sitePublic
    ? { index: true, follow: true }
    : { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  openGraph: {
    title: 'Runlabs42',
    description: 'Crea webs con IA desde el navegador. Sin terminal.',
    url: getAppUrl(),
    siteName: 'Runlabs42',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Runlabs42',
    description: 'Crea webs con IA desde el navegador.',
  },
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', type: 'image/png' }],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning data-theme="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem("sk.theme");var t=s==="dark"||s==="light"?s:(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");document.documentElement.setAttribute("data-theme",t);var l=localStorage.getItem("sk.lang");if(l){document.documentElement.setAttribute("lang",l);document.cookie="sk.lang="+l+";path=/;max-age=31536000;samesite=lax";}}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${display.variable} ${sans.variable} ${mono.variable}`}
        style={{
          fontFamily: 'var(--font-sans)',
          margin: 0,
        }}
      >
        <DemoLocalBootstrap />
        {children}
        <VercelInsights />
      </body>
    </html>
  )
}
