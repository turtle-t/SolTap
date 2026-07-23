import Script from 'next/script';
import './globals.css';
import BottomNav from '@/components/BottomNav';

export const metadata = {
  title: 'SolTap',
  description: 'Watch ads, earn Solana',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <Script src="//libtl.com/sdk.js" data-zone="11374343" data-sdk="show_11374343" strategy="beforeInteractive" />
      </head>
      <body>
        <div style={{ paddingBottom: '76px' }}>{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}