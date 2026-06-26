'use client';

import Link from 'next/link';
import { Heart, Trash2, ShoppingBag } from 'lucide-react';
import { useWishlist } from '@/lib/wishlist';
import { useCart } from '@/lib/cart';
import { useCartUI } from '@/lib/cart-ui';
import { formatPrice } from '@/lib/site-config';
import { useEffect, useState } from 'react';

export default function WishlistView() {
  const items = useWishlist((s) => s.items);
  const remove = useWishlist((s) => s.remove);
  const add = useCart((s) => s.add);
  const openDrawer = useCartUI((s) => s.openDrawer);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="container-shop py-20" />;

  if (items.length === 0) {
    return (
      <div className="container-shop flex flex-col items-center gap-4 py-24 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-sand-200 text-brand-500">
          <Heart size={28} />
        </span>
        <h1 className="font-heading text-2xl font-bold text-ink-900">Votre liste de souhaits est vide</h1>
        <p className="text-ink-500">Ajoutez vos coups de cœur en cliquant sur le ♥ des produits.</p>
        <Link href="/#products" className="btn-cta mt-2">Découvrir la boutique</Link>
      </div>
    );
  }

  return (
    <div className="container-shop py-12">
      <h1 className="font-heading text-3xl font-black tracking-tight text-ink-900">Ma liste de souhaits</h1>
      <p className="mt-1 text-ink-500">{items.length} article{items.length > 1 ? 's' : ''}</p>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.id} className="group relative flex flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm transition hover:shadow-card">
            <Link href={`/produit/${it.slug}`} className="block">
              <div className="relative w-full overflow-hidden bg-sand-200">
                <div style={{ paddingBottom: '125%' }} />
                {it.image && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={it.image} alt={it.name} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
                )}
              </div>
            </Link>
            <button
              onClick={() => remove(it.id)}
              aria-label="Retirer"
              className="absolute end-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink-900 shadow-sm backdrop-blur transition hover:bg-white hover:text-red-600"
            >
              <Trash2 size={16} />
            </button>
            <div className="flex flex-1 flex-col p-3">
              <Link href={`/produit/${it.slug}`} className="line-clamp-2 min-h-[2.5rem] text-sm font-bold text-ink-900 hover:text-brand-600">{it.name}</Link>
              <span className="mt-2 text-base font-black text-brand-600 md:text-lg">{formatPrice(it.price)}</span>
              <button
                onClick={() => {
                  add({ productId: it.id, name: it.name, price: it.price, qty: 1, image: it.image });
                  openDrawer();
                }}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-sand-50 shadow-soft transition hover:bg-brand-600"
              >
                <ShoppingBag size={16} /> Ajouter au panier
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
