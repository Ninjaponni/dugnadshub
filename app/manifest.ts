import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Dugnadshub — Tillerbyen Skolekorps',
    short_name: 'Dugnadshub',
    description: 'Organiser dugnader for Tillerbyen Skolekorps',
    start_url: '/',
    display: 'standalone',
    background_color: '#F5F5F7',
    theme_color: '#007AFF',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
