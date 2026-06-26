import HomeNavbar from '@/components/site/HomeNavbar';
import HomeHero from '@/components/site/HomeHero';
import FashionStatement from '@/components/site/FashionStatement';
import WhyShiraly from '@/components/site/WhyShiraly';
import Newsletter from '@/components/site/Newsletter';
import Footer from '@/components/site/Footer';
import ProductCard from '@/components/site/ProductCard';
import Reveal from '@/components/site/Reveal';
import { PackageOpen } from 'lucide-react';
import { productService, categoryService } from '@/services';
import { getCurrentLang } from '@/lib/i18n-server';
import type { Product } from '@/types';

export default async function Home() {
  const lang = await getCurrentLang();

  const [firstProductsResult, categories] = await Promise.all([
    productService.list({ perPage: 100, orderBy: 'menu_order' }).catch(() => null),
    categoryService.list({ hideEmpty: true }).catch(() => []),
  ]);

  // null => the product backend failed (distinct from "no products yet")
  const failed = firstProductsResult === null;
  let products: Product[] = firstProductsResult?.items ?? [];
  if (firstProductsResult && firstProductsResult.totalPages > 1) {
    const promises: Promise<Product[]>[] = [];
    for (let p = 2; p <= firstProductsResult.totalPages; p++) {
      promises.push(
        productService.list({ perPage: 100, orderBy: 'menu_order', page: p })
          .then((res) => res.items)
          .catch(() => [] as Product[]),
      );
    }
    products = products.concat((await Promise.all(promises)).flat());
  }

  return (
    <>
      <HomeNavbar categories={categories.map((c) => ({ name: c.name, slug: c.slug }))} />

      <HomeHero />

      {/* Products — the main shopping experience, directly on the homepage */}
      <section id="products" className="container-shop scroll-mt-24 py-12 md:py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-500">The Collection</p>
          <h2 className="font-heading mt-3 text-2xl font-black tracking-tight text-ink-900 sm:text-3xl md:text-4xl">
            SHOP THE COLLECTION
          </h2>
          <p className="mt-3 text-sm text-ink-500 sm:text-base">
            Discover the latest Shiraly essentials.
          </p>
        </Reveal>

        {failed ? (
          <div className="mx-auto mt-12 max-w-md rounded-2xl border border-ink-200 bg-white p-10 text-center shadow-sm">
            <PackageOpen className="mx-auto text-brand-400" size={40} />
            <p className="mt-4 font-bold text-ink-900">Impossible de charger les produits</p>
            <p className="mt-1 text-sm text-ink-500">Veuillez réessayer dans un instant.</p>
          </div>
        ) : products.length === 0 ? (
          <div className="mx-auto mt-12 max-w-md rounded-2xl border border-ink-200 bg-white p-10 text-center shadow-sm">
            <PackageOpen className="mx-auto text-brand-400" size={40} />
            <p className="mt-4 font-bold text-ink-900">Bientôt disponible</p>
            <p className="mt-1 text-sm text-ink-500">De nouveaux produits arrivent très prochainement.</p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => <ProductCard key={p.id} product={p} lang={lang} />)}
          </div>
        )}
      </section>

      <FashionStatement />

      <WhyShiraly />

      <Newsletter />

      <Footer />
    </>
  );
}
