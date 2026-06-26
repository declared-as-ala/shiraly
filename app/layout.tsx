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
import { SiteConfigProvider } from '@/components/site/SiteConfigContext';
import { LANG_COOKIE, normalizeLang } from '@/lib/i18n';
import { getSiteSettings } from '@/lib/admin-storage';
import type { SiteContact } from '@/components/site/SiteConfigContext';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });
const cairo = Cairo({ subsets: ['arabic'], variable: '--font-cairo' });

export const metadata: Metadata = {
  title: { template: '%s | Shiraly', default: 'Shiraly — Luxe Discret Tunisien' },
  description: 'Shiraly — la plateforme qui connecte les créateurs tunisiens du luxe discret.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const initialLang = normalizeLang(cookieStore.get(LANG_COOKIE)?.value);
  const settings = await getSiteSettings().catch(() => ({} as Partial<SiteContact>));
  const contact: SiteContact = {
    photoUrl: settings.photoUrl ?? '',
    phones: settings.phones?.length ? settings.phones : [],
    whatsapp: settings.whatsapp ?? '',
    instagram: settings.instagram ?? '',
    tiktok: settings.tiktok ?? '',
    facebook: settings.facebook ?? '',
  };
  return (
    <html lang={initialLang} dir={initialLang === 'ar' ? 'rtl' : 'ltr'}>
      <body className={`${inter.variable} ${playfair.variable} ${cairo.variable} font-sans antialiased`}>
        <LanguageProvider initialLang={initialLang}>
          <SiteConfigProvider contact={contact}>
            <QueryProvider>
              <NavProgress />
              <Announcement />
              {children}
              <CartDrawer />
            </QueryProvider>
          </SiteConfigProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
