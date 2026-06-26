// Shiraly — The Luxury Tunisian Brand
export const SITE = {
  name: 'Shiraly',
  domain: 'shiraly.tn',
  logo: '/hero.webp',
  /** Remote CDN fallback in case you want to reference the original instead. */
  logoRemote: '',
  announcementBar: 'SHIRALY — THE LUXURY TUNISIAN BRAND',
  hero: {
    title: 'FROM ARTIST, TO ARTIST',
    subtitle: 'Découvrez notre nouvelle collection',
  },
  categoriesTitle: 'Collections',
  productsTitle: 'FROM ARTIST, TO ARTIST',
  cta: {
    text: 'SHOP NOW',
    color: '#8B5E34',
    textColor: '#ffffff',
  },
  contact: {
    email: 'mzaliahmed73@gmail.com',
    phone: '54588271',
    whatsapp: '22479443',
    facebook: 'https://www.facebook.com/share/1GFU7WuHMb/',
    instagram: 'https://www.instagram.com/ahmed_mzali_boutique',
    tiktok: 'https://www.tiktok.com/@ahmed.mzali.boutique007',
  },
  currency: {
    code: 'TND',
    symbol: 'DT',
    decimals: 0,
  },
  cities: [
    'Ariana', 'Beja', 'Ben Arous', 'Bizerte', 'Gabes', 'Gafsa',
    'Jendouba', 'Kasserine', 'Kef', 'Mahdia', 'Manouba', 'Monastir',
    'Nabeul', 'Sfax', 'Sidi Bouzid', 'Sousse', 'Siliana', 'Tataouine',
    'Tozeur', 'Tunis', 'Zaghouan', 'Medenine', 'Kebili', 'Kairouan',
  ],
  thankYouMessage: 'مرحبا بك خلي تلفونك ديما محلول انشاالله دقائق ونكلموك',
} as const;

export function formatPrice(v: number): string {
  return `${Math.round(v)} ${SITE.currency.symbol}`;
}
