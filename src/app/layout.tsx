import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#2a1810',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Choco Choo Prague — Crepes, Waffles & Belgian Chocolate Desserts in Žižkov',
  description: 'Handcrafted crepes, waffles, croffles and desserts made with premium Belgian chocolate. Visit Choco Choo at Hartigova 77, Praha 3-Žižkov — open daily 16:00–02:00.',
  keywords: 'Choco Choo, Choco Choo Prague, Choco Choo Praha, palačinky Praha, vafle Praha, crofle, belgická čokoláda, dezerty Žižkov, crepes Prague, Belgian waffles Prague, dessert café Žižkov',
  authors: [{ name: 'Choco Choo Prague' }],
  openGraph: {
    title: 'Choco Choo Prague — Crepes, Waffles & Belgian Chocolate Desserts in Žižkov',
    description: 'Handcrafted crepes, waffles, croffles and desserts made with premium Belgian chocolate. Visit Choco Choo at Hartigova 77, Praha 3-Žižkov — open daily 16:00–02:00.',
    url: 'https://chocochoo.cz',
    siteName: 'Choco Choo Prague',
    images: [
      {
        url: '/og-share.jpg',
        width: 1280,
        height: 672,
        alt: 'Choco Choo Prague — Crepes, Waffles & Belgian Chocolate Desserts in Žižkov',
      },
    ],
    locale: 'cs_CZ',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Choco Choo Prague — Crepes, Waffles & Belgian Chocolate Desserts in Žižkov',
    description: 'Handcrafted crepes, waffles, croffles and desserts made with premium Belgian chocolate.',
    images: ['/og-share.jpg'],
  },
  icons: {
    icon: '/logo.jpg',
    apple: '/logo.jpg',
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs">
      <body>
        {children}
      </body>
    </html>
  );
}
