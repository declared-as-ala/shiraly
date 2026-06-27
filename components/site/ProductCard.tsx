import Link from 'next/link';
import type { Product } from '@/types';
import { formatPrice } from '@/lib/site-config';
import { getDictionary, type Lang } from '@/lib/i18n';
import QuickAdd from '@/components/site/QuickAdd';
import WishlistButton from '@/components/site/WishlistButton';

export default function ProductCard({ product, lang = 'fr' }: { product: Product; lang?: Lang }) {
  const t = getDictionary(lang);
  const img = product.images[0]?.url;
  const hoverImg = product.hoverImage;
  const discount = product.onSale && product.regularPrice > product.price
    ? Math.round(((product.regularPrice - product.price) / product.regularPrice) * 100)
    : 0;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-card">
      <Link href={`/produit/${product.slug}`} className="flex flex-1 flex-col">
        <div className="relative w-full overflow-hidden bg-sand-200">
          <div style={{ paddingBottom: '125%' }} />
          {img && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={img}
              alt={product.images[0]?.alt || product.name}
              className={`absolute inset-0 h-full w-full object-cover transition duration-500 ${hoverImg ? 'group-hover:opacity-0' : 'group-hover:scale-105'}`}
              loading="lazy"
            />
          )}
          {hoverImg && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={hoverImg}
              alt={product.images[0]?.alt || product.name}
              className="absolute inset-0 h-full w-full scale-105 object-cover opacity-0 transition duration-500 group-hover:scale-100 group-hover:opacity-100"
              loading="lazy"
            />
          )}
          {discount > 0 && (
            <span className="absolute start-2 top-2 z-10 rounded-md bg-brand-600 px-2 py-0.5 text-[11px] font-black text-sand-50 shadow">
              -{discount}%
            </span>
          )}
          {!product.inStock && (
            <span className="absolute start-2 bottom-2 z-10 rounded-md bg-ink-900/85 px-2 py-0.5 text-[11px] font-bold text-white">
              {t.product.outOfStock}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-3">
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-bold text-ink-900">{product.name}</h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-base font-black text-brand-600 md:text-lg">{formatPrice(product.price)}</span>
            {discount > 0 && (
              <span className="text-xs text-ink-500 line-through">{formatPrice(product.regularPrice)}</span>
            )}
          </div>
        </div>
      </Link>

      {/* Wishlist — sibling of the Link (valid HTML, intercepts its own clicks) */}
      <WishlistButton
        item={{ id: product.id, slug: product.slug, name: product.name, price: product.price, image: img ?? '' }}
        className="absolute end-2 top-2 z-20"
      />

      <div className="px-3 pb-3">
        <QuickAdd product={product} lang={lang} />
      </div>
    </div>
  );
}
