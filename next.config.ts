import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Mapbox GL krever dette
  transpilePackages: ['mapbox-gl'],
}

export default nextConfig
