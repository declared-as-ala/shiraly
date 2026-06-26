'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState, useRef } from 'react';
import { Search, Heart, ShoppingBag, Menu, X, ChevronDown } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { useCartUI } from '@/lib/cart-ui';
import { useWishlist } from '@/lib/wishlist';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '#products', label: 'New Arrivals' },
  { href: '#about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export default function HomeNavbar({ categories }: { categories: { name: string; slug: string }[] }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [colOpen, setColOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const colRef = useRef<HTMLDivElement>(null);

  const cartCount = useCart((s) => s.items.reduce((n, i) => n + i.qty, 0));
  const wishCount = useWishlist((s) => s.items.length);
  const openDrawer = useCartUI((s) => s.openDrawer);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (colRef.current && !colRef.current.contains(e.target as Node)) setColOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const iconBtn =
    'relative grid h-10 w-10 place-items-center rounded-full text-ink-900 transition hover:bg-ink-900/5 hover:text-brand-600';

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled || open
          ? 'bg-sand-50/95 shadow-[0_6px_28px_-16px_rgba(61,43,31,0.45)] backdrop-blur'
          : 'bg-gradient-to-b from-sand-50/70 to-transparent'
      }`}
    >
      <div className="container-shop flex items-center justify-between gap-3 py-3">
        {/* Mobile toggle */}
        <button
          className="grid h-10 w-10 place-items-center rounded-full text-ink-900 transition hover:bg-ink-900/5 lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={open}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 lg:flex-1" aria-label="Shiraly">
          <Image src="/star-logo.svg" alt="" width={40} height={40} priority unoptimized className="h-9 w-9 sm:h-10 sm:w-10" />
          <span className="font-heading text-xl font-black tracking-tight text-ink-900 sm:text-2xl">Shiraly</span>
        </Link>

        {/* Center nav */}
        <nav className="hidden items-center gap-7 lg:flex">
          {LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="group relative text-sm font-semibold uppercase tracking-wide text-ink-900 transition hover:text-brand-600"
            >
              {l.label}
              <span className="absolute -bottom-1 start-0 h-px w-0 bg-brand-600 transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
          <div ref={colRef} className="relative">
            <button
              onClick={() => setColOpen(!colOpen)}
              className="group relative flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-ink-900 transition hover:text-brand-600"
            >
              Collections
              <ChevronDown size={14} className={`transition duration-200 ${colOpen ? 'rotate-180' : ''}`} />
              <span className="absolute -bottom-1 start-0 h-px w-0 bg-brand-600 transition-all duration-300 group-hover:w-full" />
            </button>
            {colOpen && (
              <div className="absolute left-0 top-full mt-2 w-56 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-xl animate-in">
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

        {/* Icons */}
        <div className="flex items-center gap-1 lg:flex-1 lg:justify-end">
          <a href="#products" className={iconBtn} aria-label="Voir les produits">
            <Search size={20} />
          </a>
          <Link href="/wishlist" className={iconBtn} aria-label="Liste de souhaits">
            <Heart size={20} />
            {mounted && wishCount > 0 && (
              <span className="absolute -end-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-black text-sand-50">
                {wishCount}
              </span>
            )}
          </Link>
          <button onClick={openDrawer} className={iconBtn} aria-label="Panier">
            <ShoppingBag size={20} />
            {mounted && cartCount > 0 && (
              <span className="absolute -end-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-black text-sand-50">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="border-t border-ink-200 bg-sand-50 px-4 py-3 lg:hidden">
          {[...LINKS, { href: '#products', label: 'Collections' }].map((l) => (
            <Link
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-semibold uppercase tracking-wide text-ink-900 hover:bg-ink-100"
            >
              {l.label}
            </Link>
          ))}
          {categories.length > 0 && (
            <>
              <p className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-widest text-ink-500">Collections</p>
              {categories.map((c) => (
                <Link
                  key={c.slug}
                  href={`/categorie/${c.slug}`}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 font-semibold text-ink-900 hover:bg-ink-100"
                >
                  {c.name}
                </Link>
              ))}
            </>
          )}
        </nav>
      )}
    </header>
  );
}
