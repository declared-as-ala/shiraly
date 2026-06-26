'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, Sparkles, Phone, ChevronLeft, ChevronRight } from 'lucide-react';
import { SITE } from '@/lib/site-config';
import { useLanguage } from '@/components/site/LanguageProvider';
import { useEffect, useState, useCallback } from 'react';

type Slide = {
  imageUrl: string;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  buttonLink?: string;
};

export default function Hero() {
  const { lang, t } = useLanguage();
  const ArrowIcon = lang === 'ar' ? ArrowLeft : ArrowRight;
  const [slides, setSlides] = useState<Slide[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/slides')
      .then((r) => r.json())
      .then((data: Slide[]) => {
        setSlides(data.length ? data : [{
          imageUrl: '',
          title: t.common.brandName,
          subtitle: t.hero.title,
          buttonText: t.common.buyNow,
          buttonLink: '#produits',
        }]);
      })
      .catch(() => {
        setSlides([{
          imageUrl: '',
          title: t.common.brandName,
          subtitle: t.hero.title,
          buttonText: t.common.buyNow,
          buttonLink: '#produits',
        }]);
      })
      .finally(() => setLoading(false));
  }, [t.common.brandName, t.hero.title, t.common.buyNow]);

  const next = useCallback(() => setCurrent((c) => (c + 1) % slides.length), [slides.length]);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(next, 5000);
    return () => clearInterval(id);
  }, [next, slides.length]);

  if (loading) {
    return (
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 text-white">
        <div className="container-shop py-8 md:py-12 lg:py-16">
          <div className="h-32 animate-pulse rounded-xl bg-white/10" />
        </div>
      </section>
    );
  }

  const slide = slides[current] ?? slides[0];
  const hasSlider = slides.length > 1;

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_-10%,rgba(219,199,184,.20),transparent_45%),radial-gradient(circle_at_88%_115%,rgba(139,94,52,.28),transparent_50%)]" />
      <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:60px_60px]" />

      <div className="container-shop relative py-2 md:py-3 lg:py-4">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white backdrop-blur ring-1 ring-white/20">
            <Sparkles size={12} /> {t.hero.collection}
          </span>

          <h1 className="font-heading mt-1 text-xl font-black leading-[1.05] tracking-tight sm:text-2xl md:text-3xl lg:text-5xl">
            {slide.title ?? t.common.brandName}
          </h1>

          <p className="font-heading mt-1 max-w-xl text-xs font-semibold italic text-white/90 sm:text-sm md:text-base">
            {slide.subtitle ?? t.hero.title}
          </p>

          <div className="mt-1 flex flex-wrap gap-1.5 md:hidden">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-[11px] font-black text-brand-700 shadow-lg">
              <span className="grid h-4 w-4 place-items-center rounded-full bg-brand-500 text-sand-50"><Sparkles size={10} /></span>
              {t.hero.topSale}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-[11px] font-black text-brand-700 shadow-lg">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
              {t.hero.deliveryTunisia}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-3 py-1 text-[11px] font-black text-sand-50 shadow-cta">
              {t.hero.cashOnDelivery}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Link href={(slide.buttonLink as string) ?? '#produits'} className="btn-cta shake-cta text-xs md:text-sm">
              {slide.buttonText ?? t.common.buyNow} <ArrowIcon size={16} />
            </Link>
            <a
              href={`tel:${SITE.contact.phone}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/10 px-2 py-1.5 text-xs font-bold text-white backdrop-blur transition hover:bg-white/20"
            >
              <Phone size={14} /> {SITE.contact.phone}
            </a>
          </div>

          <div className="mt-2 flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs">
              <span className="inline-flex items-center gap-1.5 text-white/90"><Sparkles size={15} className="text-sand-400" /> {t.hero.deliveryTime}</span>
              <span className="hidden h-3 w-px bg-white/20 sm:block" />
              <span className="inline-flex items-center gap-1.5 text-white/90"><Sparkles size={15} className="text-sand-400" /> {t.hero.paymentCod}</span>
              <span className="hidden h-3 w-px bg-white/20 sm:block" />
              <span className="inline-flex items-center gap-1.5 text-white/90"><Sparkles size={15} className="text-sand-400" /> {t.hero.easyExchange}</span>
            </div>
          </div>

          {hasSlider && (
            <div className="mt-4 flex items-center gap-3">
              <div className="flex gap-1.5">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrent(i)}
                    className={`h-2 rounded-full transition-all ${i === current ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/60'}`}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>
              <div className="flex gap-1">
                <button onClick={prev} className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25" aria-label="Précédent">
                  <ChevronLeft size={14} />
                </button>
                <button onClick={next} className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25" aria-label="Suivant">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
