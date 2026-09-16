import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'School Tracking',
    template: '%s · School Tracking',
  },
  description: 'Private portal for school staff and parents.',
  // Belt and braces with the X-Robots-Tag header in next.config.ts. No page
  // in this application should ever appear in a search index.
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Pinching to zoom is left enabled deliberately; disabling it is a common
  // accessibility failure for anyone who needs to enlarge text.
  themeColor: '#1d4ed8',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  )
}
