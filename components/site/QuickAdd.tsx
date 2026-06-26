'use client';

import Link from 'next/link';
import { ShoppingBag, SlidersHorizontal } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { useCartUI } from '@/lib/cart-ui';
import type { Product } from '@/types';
import { getDictionary, type Lang } from '@/lib/i18n';

/**
 * Per-card "Ajouter au panier".
 * Simple products are added instantly and the drawer slides open.
 * Products with options/bundles route to the product page to pick them.
 */
export default function QuickAdd({ product, lang = 'fr' }: { product: Product; lang?: Lang }) {
  const t = getDictionary(lang);
  const add = useCart((s) => s.add);
  const openDrawer = useCartUI((s) => s.openDrawer);

  const needsOptions =
    product.bundles.length > 0 || product.attributes.some((a) => a.options.length > 0);

  const base =
    'inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[.98]';

  if (!product.inStock) {
    return (
      <button disabled className={`${base} cursor-not-allowed bg-ink-100 text-ink-500`}>
        {t.product.outOfStock}
      </button>
    );
  }

  if (needsOptions) {
    return (
      <Link href={`/produit/${product.slug}`} className={`${base} border border-brand-300 bg-white text-brand-600 hover:bg-brand-50`}>
        <SlidersHorizontal size={16} /> {t.product.viewProduct}
      </Link>
    );
  }

  return (
    <button
      onClick={() => {
        add({
          productId: product.id,
          name: product.name,
          price: product.price,
          qty: 1,
          image: product.images[0]?.url ?? '',
        });
        openDrawer();
      }}
      className={`${base} bg-brand-500 text-sand-50 shadow-soft hover:bg-brand-600`}
    >
      <ShoppingBag size={16} /> {t.product.addToCart}
    </button>
  );
}
