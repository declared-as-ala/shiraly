import Header from '@/components/site/Header';
import Footer from '@/components/site/Footer';
import WishlistView from '@/components/site/WishlistView';
import { categoryService } from '@/services';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Liste de souhaits' };

export default async function WishlistPage() {
  const categories = await categoryService.list({ hideEmpty: true }).catch(() => []);
  return (
    <>
      <Header categories={categories.map((c) => ({ name: c.name, slug: c.slug }))} />
      <WishlistView />
      <Footer />
    </>
  );
}
