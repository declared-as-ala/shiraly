import Header from '@/components/site/Header';
import Footer from '@/components/site/Footer';
import { categoryService } from '@/services';
import { getSiteSettings } from '@/lib/admin-storage';
import { getDictionary } from '@/lib/i18n';
import { getCurrentLang } from '@/lib/i18n-server';
import { Mail, Phone, MapPin, Clock, Instagram, Music2, Facebook, Send, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Contactez Nous' };

export default async function ContactPage() {
  const lang = await getCurrentLang();
  const t = getDictionary(lang);
  const [saved, categories] = await Promise.all([
    getSiteSettings(),
    categoryService.list({ hideEmpty: true }).catch(() => []),
  ]);

  const whatsapp = saved.whatsapp ?? '54588271';
  const instagram = saved.instagram ?? 'https://www.instagram.com/ahmed_mzali_boutique';
  const facebook = saved.facebook ?? 'https://www.facebook.com/share/1GFU7WuHMb/';
  const tiktok = saved.tiktok ?? 'https://www.tiktok.com/@ahmed.mzali.boutique007';

  return (
    <>
      <Header categories={categories.map((c) => ({ name: c.name, slug: c.slug }))} />

      <section className="relative overflow-hidden bg-gradient-to-b from-sand-100 to-sand-50 py-20 md:py-32">
        <div className="absolute inset-0 opacity-[0.04] [background-image:radial-gradient(circle_at_1px_1px,#3D2B1F_1px,transparent_0)] [background-size:32px_32px]" />
        <div className="absolute right-0 top-0 h-96 w-96 translate-x-1/3 -translate-y-1/3 rounded-full bg-brand-200/40 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-80 w-80 -translate-x-1/4 translate-y-1/4 rounded-full bg-brand-100/50 blur-3xl" />

        <div className="container-shop relative">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
              <Sparkles size={12} /> Get in Touch
            </span>
            <h1 className="font-heading mt-6 text-4xl font-black leading-[1.05] tracking-tight text-ink-900 sm:text-5xl md:text-6xl">
              Contactez Nous
            </h1>
            <p className="mt-4 text-base text-ink-500 sm:text-lg">
              Une question&thinsp;? Notre équipe est là pour vous répondre.
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-5xl gap-6 sm:grid-cols-2">
            <a
              href="mailto:shiralyart@gmail.com"
              className="group relative overflow-hidden rounded-2xl border border-ink-200/60 bg-white p-8 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_48px_-12px_rgba(139,94,52,0.2)]"
            >
              <div className="absolute right-0 top-0 h-32 w-32 translate-x-1/3 -translate-y-1/3 rounded-full bg-brand-100/60 blur-2xl transition-all duration-500 group-hover:scale-150" />
              <div className="relative">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-200/50">
                  <Mail size={24} />
                </span>
                <h3 className="font-heading mt-5 text-xl font-bold text-ink-900">Email</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">
                  Notre équipe répond sous 24h.
                </p>
                <p className="mt-3 text-lg font-bold text-brand-600 transition-colors group-hover:text-brand-700">
                  shiralyart@gmail.com
                </p>
              </div>
            </a>

            <a
              href="tel:54588271"
              className="group relative overflow-hidden rounded-2xl border border-ink-200/60 bg-white p-8 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_48px_-12px_rgba(139,94,52,0.2)]"
            >
              <div className="absolute right-0 top-0 h-32 w-32 translate-x-1/3 -translate-y-1/3 rounded-full bg-brand-100/60 blur-2xl transition-all duration-500 group-hover:scale-150" />
              <div className="relative">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-200/50">
                  <Phone size={24} />
                </span>
                <h3 className="font-heading mt-5 text-xl font-bold text-ink-900">Téléphone</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">
                  Lun–Sam, 9h–19h.
                </p>
                <p className="mt-3 text-lg font-bold text-brand-600 transition-colors group-hover:text-brand-700">
                  +216 54 588 271
                </p>
              </div>
            </a>

            <a
              href={`https://wa.me/21654588271`}
              target="_blank"
              rel="noopener"
              className="group relative overflow-hidden rounded-2xl border border-ink-200/60 bg-white p-8 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_48px_-12px_rgba(139,94,52,0.2)]"
            >
              <div className="absolute right-0 top-0 h-32 w-32 translate-x-1/3 -translate-y-1/3 rounded-full bg-[#25D366]/10 blur-2xl transition-all duration-500 group-hover:scale-150" />
              <div className="relative">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#25D366]/10 text-[#25D366] ring-1 ring-[#25D366]/20">
                  <Send size={24} />
                </span>
                <h3 className="font-heading mt-5 text-xl font-bold text-ink-900">WhatsApp</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">
                  Réponse rapide sur WhatsApp.
                </p>
                <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white transition-all group-hover:brightness-95">
                  <Send size={15} /> Écrire sur WhatsApp
                </p>
              </div>
            </a>

            <div className="relative overflow-hidden rounded-2xl border border-ink-200/60 bg-white p-8 shadow-card">
              <div className="absolute right-0 top-0 h-32 w-32 translate-x-1/3 -translate-y-1/3 rounded-full bg-brand-100/60 blur-2xl" />
              <div className="relative">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-200/50">
                  <MapPin size={24} />
                </span>
                <h3 className="font-heading mt-5 text-xl font-bold text-ink-900">Adresse</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">
                  Livraison dans toute la Tunisie.
                </p>
                <p className="mt-3 flex items-center gap-2 text-sm text-ink-500">
                  <Clock size={14} /> Lun–Sam 9h–19h
                </p>
              </div>
            </div>
          </div>

          <div className="mt-14 text-center">
            <div className="inline-flex items-center gap-3 rounded-full bg-brand-500/5 px-6 py-2">
              <span className="h-2 w-2 rounded-full bg-brand-500" />
              <span className="text-xs font-bold uppercase tracking-[0.15em] text-brand-600">
                Suivez-nous
              </span>
            </div>
            <div className="mt-5 flex justify-center gap-4">
              <a href={facebook} target="_blank" rel="noopener" aria-label="Facebook" className="group grid h-14 w-14 place-items-center rounded-2xl border border-ink-200/60 bg-white text-ink-500 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#1877F2]/30 hover:bg-[#1877F2] hover:text-white hover:shadow-lg">
                <Facebook size={20} />
              </a>
              <a href={instagram} target="_blank" rel="noopener" aria-label="Instagram" className="group grid h-14 w-14 place-items-center rounded-2xl border border-ink-200/60 bg-white text-ink-500 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
                <Instagram size={20} className="transition-all duration-300 group-hover:scale-110" />
                <span className="sr-only">Instagram</span>
              </a>
              <a href={tiktok} target="_blank" rel="noopener" aria-label="TikTok" className="group grid h-14 w-14 place-items-center rounded-2xl border border-ink-200/60 bg-white text-ink-500 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-black/30 hover:bg-black hover:text-white hover:shadow-lg">
                <Music2 size={20} />
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
