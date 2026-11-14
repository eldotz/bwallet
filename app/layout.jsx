import './globals.css';

export const metadata = {
  title: 'BWallet — Partnership finances',
  description: 'A clear view of your shared business money.'
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
