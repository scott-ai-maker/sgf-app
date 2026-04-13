import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Scott Gordon Fitness',
  description: 'Online personal coaching — personalized programming, real accountability, measurable results.',
  metadataBase: new URL('https://scottgordonfitness.com'),
  icons: {
    icon: '/images/logo-mark-source.jpg',
    shortcut: '/images/logo-mark-source.jpg',
    apple: '/images/logo-mark-source.jpg',
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
