import './globals.css';
import type { Metadata } from 'next';
import { Inter, Playfair_Display, Cairo } from 'next/font/google';
import { cookies } from 'next/headers';
import './globals.css';
import QueryProvider from './QueryProvider';
import CartDrawer from '@/components/site/CartDrawer';
import Announcement from '@/components/site/Announcement';
import NavProgress from '@/components/NavProgress';
import { LanguageProvider } from '@/components/site/LanguageProvider';
import { LANG_COOKIE, normalizeLang } from '@/lib/i18n';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });
const cairo = Cairo({ subsets: ['arabic'], variable: '--font-cairo' });

export const metadata: Metadata = {
  title: { template: '%s | Shiraly', default: 'Shiraly — Luxe Discret Tunisien' },
  description: 'Shiraly — la plateforme qui connecte les créateurs tunisiens du luxe discret.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const initialLang = normalizeLang(cookieStore.get(LANG_COOKIE)?.value);
  return (
    <html lang={initialLang} dir={initialLang === 'ar' ? 'rtl' : 'ltr'}>
      <body className={`${inter.variable} ${playfair.variable} ${cairo.variable} font-sans antialiased`}>
        <LanguageProvider initialLang={initialLang}>
          <QueryProvider>
            <NavProgress />
            <Announcement />
            {children}
            <CartDrawer />
          </QueryProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
