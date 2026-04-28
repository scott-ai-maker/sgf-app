import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Scott Gordon Fitness',
    short_name: 'SGF',
    description: 'Online personal coaching with personalized programming and accountability.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0D1B2A',
    theme_color: '#0D1B2A',
    orientation: 'portrait',
    icons: [
      {
        src: '/images/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/images/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/images/icon-192.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
