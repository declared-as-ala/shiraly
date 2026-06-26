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
    photoUrl: '',
    phones: [],
    email: '',
    phone: '',
    whatsapp: '',
    facebook: '',
    instagram: '',
    tiktok: '',
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
};

export function formatPrice(v: number): string {
  return `${Math.round(v)} ${SITE.currency.symbol}`;
}
