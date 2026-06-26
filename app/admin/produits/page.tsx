import { productService } from '@/services';
import ProduitsView from '@/components/admin/ProduitsView';

export const dynamic = 'force-dynamic';

export default async function Produits() {
  const result = await productService.list({ perPage: 100, status: 'any', orderBy: 'menu_order', order: 'asc' }).catch(() => ({
    items: [], total: 0, totalPages: 0, page: 1,
  }));
  const products = result.items;
  const totals = {
    stock: products.reduce((s, p) => s + (p.stockQuantity !== null ? p.stockQuantity : (p.inStock ? 50 : 0)), 0),
    outOfStock: products.filter((p) => !p.inStock).length,
    revenuePotential: products.reduce((s, p) => s + (p.stockQuantity !== null ? p.stockQuantity : (p.inStock ? 50 : 0)) * p.price, 0),
  };
  return <ProduitsView initialProducts={products} totals={totals} />;
}
