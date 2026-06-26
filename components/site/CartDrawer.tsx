'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { useCart, selectSubtotal, selectCount } from '@/lib/cart';
import { useCartUI } from '@/lib/cart-ui';
import { formatPrice } from '@/lib/site-config';
import { useLanguage } from '@/components/site/LanguageProvider';

export default function CartDrawer() {
  const { t } = useLanguage();
  const open = useCartUI((s) => s.open);
  const closeDrawer = useCartUI((s) => s.closeDrawer);

  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);

  const subtotal = selectSubtotal(items);
  const count = selectCount(items);

  // Close on Escape + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeDrawer();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, closeDrawer]);

  return (
    <>
      {/* Overlay */}
      <div
        aria-hidden
        onClick={closeDrawer}
        className={`fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Panel — slides in from the right, full-width on mobile */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t.cart.title}
        className={`fixed end-0 top-0 z-50 flex h-[100dvh] w-full max-w-md flex-col bg-sand-100 shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full rtl:-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-200 bg-white px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-500 text-sand-50">
              <ShoppingBag size={18} />
            </span>
            <div>
              <p className="font-heading text-lg font-bold leading-none text-ink-900">{t.cart.title}</p>
              <p className="mt-0.5 text-xs text-ink-500">{t.common.articlesCount(count)}</p>
            </div>
          </div>
          <button
            onClick={closeDrawer}
            aria-label="Fermer"
            className="grid h-10 w-10 place-items-center rounded-full text-ink-500 transition hover:bg-ink-100 hover:text-ink-900"
          >
            <X size={20} />
          </button>
        </div>

        {/* Items */}
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-sand-300 text-brand-500">
              <ShoppingBag size={28} />
            </span>
            <p className="font-bold text-ink-900">{t.cart.empty}</p>
            <p className="text-sm text-ink-500">{t.cart.emptyHint}</p>
            <button onClick={closeDrawer} className="btn-cta mt-2">
              {t.cart.continueShopping}
            </button>
          </div>
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {items.map((it) => (
              <div key={it.lineId} className="flex gap-3 rounded-2xl border border-ink-200 bg-white p-3 shadow-sm">
                <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-sand-200">
                  {it.image && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={it.image} alt={it.name} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-bold text-ink-900">{it.name}</p>
                    <button
                      onClick={() => remove(it.lineId)}
                      aria-label={t.cart.remove}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-500 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  {it.variation && (
                    <p className="mt-0.5 truncate text-xs text-ink-500">
                      {Object.entries(it.variation).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <div className="flex items-center rounded-lg border border-ink-200">
                      <button
                        onClick={() => setQty(it.lineId, it.qty - 1)}
                        aria-label={t.product.decreaseQty}
                        className="grid h-8 w-8 place-items-center text-ink-700 hover:bg-ink-100"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center text-sm font-bold">{it.qty}</span>
                      <button
                        onClick={() => setQty(it.lineId, it.qty + 1)}
                        aria-label={t.product.increaseQty}
                        className="grid h-8 w-8 place-items-center text-ink-700 hover:bg-ink-100"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <span className="font-black text-brand-600">{formatPrice(it.price * it.qty)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer / summary */}
        {items.length > 0 && (
          <div className="space-y-3 border-t border-ink-200 bg-white px-5 py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-500">{t.cart.subtotal}</span>
              <span className="text-lg font-black text-ink-900">{formatPrice(subtotal)}</span>
            </div>
            <p className="text-xs text-ink-500">{t.cart.shipping} — {t.cart.shippingNext}</p>
            <Link href="/commande" onClick={closeDrawer} className="btn-cta w-full">
              {t.cart.checkout} <ArrowRight size={18} className="rtl:rotate-180" />
            </Link>
            <div className="flex gap-2">
              <button onClick={closeDrawer} className="btn-ghost flex-1">
                {t.cart.continueShopping}
              </button>
              <Link href="/panier" onClick={closeDrawer} className="btn-ghost flex-1">
                {t.cart.viewCart}
              </Link>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
