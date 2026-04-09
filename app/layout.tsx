import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Scott Gordon Fitness',
  description: 'Online personal coaching — personalized programming, real accountability, measurable results.',
  metadataBase: new URL('https://scottgordonfitness.com'),
  openGraph: {
    title: 'Scott Gordon Fitness',
    description: 'Online personal coaching built around you.',
    url: 'https://scottgordonfitness.com',
    siteName: 'Scott Gordon Fitness',
    locale: 'en_US',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
