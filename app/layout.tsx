import type { Metadata, Viewport } from 'next'
import './globals.css'
import MobilePortraitLock from '@/components/ui/MobilePortraitLock'
import ServiceWorkerRegistrar from '@/components/ui/ServiceWorkerRegistrar'

export const metadata: Metadata = {
  title: 'Scott Gordon Fitness',
  description: 'Online personal coaching — personalized programming, real accountability, measurable results.',
  metadataBase: new URL('https://scottgordonfitness.com'),
  applicationName: 'Scott Gordon Fitness',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/favicon.ico', sizes: '32x32' }, { url: '/images/icon-192.png', sizes: '192x192', type: 'image/png' }],
    shortcut: '/favicon.ico',
    apple: '/images/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SGF',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'Scott Gordon Fitness',
    description: 'Online personal coaching built around you.',
    url: 'https://scottgordonfitness.com',
    siteName: 'Scott Gordon Fitness',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/images/og-image.jpg',
        width: 1344,
        height: 768,
        alt: 'Scott Gordon Fitness gym training visual',
      },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: '#0D1B2A',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <MobilePortraitLock />
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  )
}
