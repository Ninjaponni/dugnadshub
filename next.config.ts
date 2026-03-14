import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['mapbox-gl'],
  devIndicators: false,
}

export default nextConfig
