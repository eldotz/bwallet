import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');

export const metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: {
    default: 'BWallet — Partnership finances',
    template: '%s | BWallet'
  },
  description: 'Track shared business money, partner balances, expenses, investments, and loans in one clear partnership hub.',
  applicationName: 'BWallet',
  keywords: ['partnership finance', 'shared business expenses', 'partner wallet', 'business expense tracker', 'small business finance', 'shared wallet', 'business loans'],
  category: 'finance',
  creator: 'BWallet',
  publisher: 'BWallet',
  referrer: 'strict-origin-when-cross-origin',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg'
  },
  manifest: '/site.webmanifest',
  ...(siteUrl ? { alternates: { canonical: '/' } } : {}),
  openGraph: {
    type: 'website',
    siteName: 'BWallet',
    title: 'BWallet — Partnership finances',
    description: 'A clear, shared view of business money for partners.',
    ...(siteUrl ? { url: siteUrl } : {})
  },
  twitter: {
    card: 'summary',
    title: 'BWallet — Partnership finances',
    description: 'Track shared business money without spreadsheets.'
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1
    }
  }
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#14333a'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
