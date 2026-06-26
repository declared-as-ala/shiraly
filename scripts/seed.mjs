// Seed script — Shiraly storefront (MongoDB Atlas).
// Run:  node scripts/seed.mjs
// Idempotent: upserts categories + products by slug, never deletes admin data.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// ── Load MONGODB_URI from .env.local / .env ─────────────────────────────
function loadEnv(file) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv('.env.local');
loadEnv('.env');

const URI = process.env.MONGODB_URI;
if (!URI) { console.error('MONGODB_URI not set'); process.exit(1); }

const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Real keyword-matched photos (no API key). Distinct `lock` per shot so the
// primary and hover images differ — making the card hover-swap visible.
const flickr = (keywords, lock) => `https://loremflickr.com/600/750/${encodeURIComponent(keywords)}?lock=${lock}`;

// ── Source data (from the OLD MONEY / STREET WEAR collection) ───────────
const CATEGORIES = [
  { name: 'OLD MONEY', slug: 'old-money', description: 'OLD MONEY collection' },
  { name: 'STREET WEAR', slug: 'street-wear', description: 'Street wear essentials' },
];

const PRODUCTS = [
  { name: 'Pack all outfit', regularPrice: 190, salePrice: 79, kw: 'mens,fashion,outfit' },
  { name: 'KAMRAYA PANTS', regularPrice: 112, salePrice: 59, kw: 'trousers,fashion' },
  { name: 'wide-leg TROUSERS', regularPrice: 110, salePrice: 59, kw: 'trousers,pants' },
  { name: 'knit polo black', regularPrice: 80, salePrice: 35, kw: 'polo,shirt' },
  { name: 'polo knit beige', regularPrice: 80, salePrice: 35, kw: 'polo,shirt,beige' },
  { name: 'LEATHER JACKET BROWN', regularPrice: 189, salePrice: 110, kw: 'brown,leather,jacket' },
  { name: 'LEATHER JACKET BLACK', regularPrice: 189, salePrice: 110, kw: 'leather,jacket' },
  { name: 'black hoddie', regularPrice: 81, salePrice: 39, kw: 'black,hoodie' },
  { name: 'GRIS JEAN PANTS', regularPrice: 99, salePrice: 74, kw: 'jeans,denim' },
  { name: 'BROWN STAR hoddie', regularPrice: 81, salePrice: 39, kw: 'hoodie,streetwear' },
  { name: 'crop cut t shirt', regularPrice: 69, salePrice: 35, kw: 'tshirt,fashion' },
];

const loose = new mongoose.Schema({}, { strict: false, timestamps: true });
const Category = mongoose.model('Category', loose, 'categories');
const Product = mongoose.model('Product', loose, 'products');

async function main() {
  await mongoose.connect(URI, { bufferCommands: false });
  console.log('Connected to', mongoose.connection.name);

  // Categories
  const catIdBySlug = {};
  for (const c of CATEGORIES) {
    const doc = await Category.findOneAndUpdate(
      { slug: c.slug },
      { $set: { name: c.name, slug: c.slug, description: c.description } },
      { upsert: true, new: true },
    );
    catIdBySlug[c.slug] = String(doc._id);
    console.log('category:', c.name);
  }

  const categoryIds = Object.values(catIdBySlug);
  const categorySlugs = CATEGORIES.map((c) => c.slug);

  // Products — all assigned to both collections
  let order = 0;
  for (const p of PRODUCTS) {
    const slug = slugify(p.name);
    await Product.findOneAndUpdate(
      { slug },
      {
        $set: {
          slug,
          name: p.name,
          status: 'published',
          description: `${p.name} — Shiraly, the luxury Tunisian brand.`,
          shortDescription: 'Édition limitée OLD MONEY × STREET WEAR.',
          regularPrice: p.regularPrice,
          salePrice: p.salePrice,
          currency: 'TND',
          inStock: true,
          stockQuantity: null,
          images: [{ url: flickr(p.kw, order + 1), alt: p.name }],
          hoverImage: flickr(p.kw, order + 101),
          categoryIds,
          categorySlugs,
          attributes: [],
          bundles: [],
          upsellIds: [],
          crossSellIds: [],
          meta: {},
          menuOrder: order++,
        },
      },
      { upsert: true, new: true },
    );
    console.log(`product: ${p.name}  ${p.regularPrice}→${p.salePrice} DT`);
  }

  const total = await Product.countDocuments();
  console.log(`\nDone. ${PRODUCTS.length} products seeded. Collection now holds ${total} products.`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
