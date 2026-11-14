import './globals.css';

export const metadata = {
  title: 'BWallet — Partnership finances',
  description: 'A clear view of your shared business money.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
