import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Emits .next/standalone with a self-contained server.js, which is what the
  // Hostinger Node.js runtime starts. Keeps the deployed bundle small.
  output: 'standalone',

  // Never let a private page reach a search index, and apply the usual
  // hardening headers. `noindex` is set globally because every route behind
  // /admin, /teacher and /parent shows student data; the login page opts back
  // in via its own metadata.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), payment=(), interest-cohort=()',
          },
        ],
      },
    ]
  },
}

export default nextConfig
