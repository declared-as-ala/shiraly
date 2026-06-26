import { Gem, Truck, RefreshCw, ShieldCheck } from 'lucide-react';
import Reveal from '@/components/site/Reveal';

const ITEMS = [
  { icon: Gem, title: 'Premium Style', text: 'Curated old-money meets streetwear essentials.' },
  { icon: Truck, title: 'Delivery Across Tunisia', text: 'Fast, reliable shipping to every governorate.' },
  { icon: RefreshCw, title: 'Easy Exchange', text: 'Hassle-free exchanges within days.' },
  { icon: ShieldCheck, title: 'Secure Payment', text: 'Cash on delivery — pay when it arrives.' },
];

export default function WhyShiraly() {
  return (
    <section className="container-shop py-12 md:py-24">
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {ITEMS.map((it, i) => (
          <Reveal key={it.title} delay={i * 100}>
            <div className="flex h-full flex-col items-center gap-3 rounded-2xl border border-ink-200 bg-white px-4 py-6 text-center shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-card sm:px-6 sm:py-8">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-sand-200 text-brand-600 transition duration-300 group-hover:bg-brand-50 sm:h-14 sm:w-14">
                <it.icon size={24} strokeWidth={1.6} />
              </span>
              <h3 className="font-heading text-base font-bold text-ink-900 sm:text-lg">{it.title}</h3>
              <p className="text-xs text-ink-500 sm:text-sm">{it.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
