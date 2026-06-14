import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  productionBrowserSourceMaps: false,
  experimental: {
    webpackBuildWorker: false,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "satelit.bmkg.go.id" },
      { protocol: "https", hostname: "inderaja.bmkg.go.id" },
      { protocol: "https", hostname: "nowcasting.bmkg.go.id" },
      { protocol: "https", hostname: "web-meteo.bmkg.go.id" },
      { protocol: "https", hostname: "web.meteo.bmkg.go.id" },
      { protocol: "https", hostname: "aviation.bmkg.go.id" },
      { protocol: "https", hostname: "api-apps.bmkg.go.id" },
      { protocol: "https", hostname: "www.cpc.ncep.noaa.gov" },
      { protocol: "https", hostname: "www.bom.gov.au" },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'same-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(self), accelerometer=(self), gyroscope=(self), magnetometer=(self)',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
