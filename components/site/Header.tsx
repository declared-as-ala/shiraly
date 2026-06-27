'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ShoppingBag, Search, Menu, X, Phone, ChevronDown } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { useCartUI } from '@/lib/cart-ui';
import { SITE } from '@/lib/site-config';
import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/components/site/LanguageProvider';
import LanguageSwitcher from '@/components/site/LanguageSwitcher';
import { useSiteConfig } from '@/components/site/SiteConfigContext';
import SearchOverlay from './SearchOverlay';

export default function Header({ categories }: { categories: { name: string; slug: string }[] }) {
  const items = useCart((s) => s.items);
  const count = items.reduce((n, i) => n + i.qty, 0);
  const openDrawer = useCartUI((s) => s.openDrawer);
  const [open, setOpen] = useState(false);
  const [colOpen, setColOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const colRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();
  const siteConfig = useSiteConfig();
  const primaryPhone = siteConfig.phones[0] ?? SITE.contact.phone;

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (colRef.current && !colRef.current.contains(e.target as Node)) setColOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const navLinks = [
    { href: '/', label: t.nav.home },
    { href: '/contact', label: t.nav.contact },
  ];

  return (
    <>
      <div className="announce-bar py-2 text-center text-xs sm:text-sm">
        {t.nav.announcement}
      </div>
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-sand-50/95 backdrop-blur">
        <div className="container-shop flex items-center gap-3 py-3 sm:gap-4">
          <button
            className="grid min-h-11 min-w-11 place-items-center rounded-lg text-ink-900 hover:bg-ink-100 lg:hidden"
            onClick={() => setOpen(!open)}
            aria-label={t.nav.menu}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>

          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={t.common.brandName}>
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-700 sm:h-10 sm:w-10">
              <Image src="/star-logo.svg" alt="" width={40} height={40} priority unoptimized className="h-5 w-5 sm:h-6 sm:w-6" />
            </span>
            <span className="font-heading text-lg font-black tracking-tight text-ink-900 sm:text-2xl">{t.common.brandName}</span>
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
            {navLinks.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-900 transition hover:bg-ink-100 hover:text-brand-600">
                {l.label}
              </Link>
            ))}
            <div ref={colRef} className="relative">
              <button
                onClick={() => setColOpen(!colOpen)}
                className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-ink-900 transition hover:bg-ink-100 hover:text-brand-600"
              >
                {t.nav.collections} <ChevronDown size={14} className={`transition duration-200 ${colOpen ? 'rotate-180' : ''}`} />
              </button>
              {colOpen && (
                <div className="absolute left-0 top-full mt-1 w-56 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-xl animate-in">
                  <div className="p-2">
                    {categories.length > 0 ? categories.map((c) => (
                      <Link
                        key={c.slug}
                        href={`/categorie/${c.slug}`}
                        onClick={() => setColOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-ink-900 transition hover:bg-sand-100 hover:text-brand-600"
                      >
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-xs font-black text-brand-600">
                          {c.name.charAt(0)}
                        </span>
                        {c.name}
                      </Link>
                    )) : (
                      <p className="px-4 py-3 text-sm text-ink-500">Aucune collection</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </nav>

          <div className="flex flex-1 items-center justify-end gap-2">
            <a href={`tel:${primaryPhone}`} className="hidden items-center gap-2 rounded-lg bg-brand-500/10 px-3 py-2 text-sm font-bold text-brand-600 hover:bg-brand-500/20 sm:inline-flex">
              <Phone size={14} />
              {primaryPhone}
            </a>
            <LanguageSwitcher />
            <button onClick={() => setSearchOpen(true)} className="grid min-h-11 min-w-11 place-items-center rounded-lg text-ink-900 hover:bg-ink-100" aria-label={t.nav.search}>
              <Search size={20} />
            </button>
            <button onClick={openDrawer} className="relative grid min-h-11 min-w-11 place-items-center rounded-lg text-ink-900 hover:bg-ink-100" aria-label={t.nav.cart}>
              <ShoppingBag size={20} />
              {count > 0 && <span className="absolute -end-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-brand-500 text-[10px] font-black text-sand-50">{count}</span>}
            </button>
          </div>
        </div>

        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out lg:hidden ${
            open ? 'max-h-[640px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <nav className="border-t border-ink-200 bg-sand-50 p-3">
            {navLinks.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 font-semibold text-ink-900 hover:bg-ink-100">
                {l.label}
              </Link>
            ))}
            {categories.length > 0 && (
              <>
                <p className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-widest text-ink-500">{t.nav.collections}</p>
                {categories.map((c) => (
                  <Link key={c.slug} href={`/categorie/${c.slug}`} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 font-semibold text-ink-900 hover:bg-ink-100">{c.name}</Link>
                ))}
              </>
            )}
          </nav>
        </div>
      </header>
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
