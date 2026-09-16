import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Left on the default build output rather than 'standalone'. Hostinger's
  // managed Node.js runtime starts the app with `next start`, which refuses to
  // run against a standalone build — that mode expects you to launch
  // .next/standalone/server.js yourself. Compatibility with the host matters
  // more here than the smaller bundle standalone would give.

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
