// One-off: backfill missing order-line name/image from the product.
// Storefront orders were saved with empty item name/image because the finalize
// update overwrote them. Run: node scripts/backfill-order-items.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
function loadEnv(f) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv('.env.local'); loadEnv('.env');
const URI = process.env.MONGODB_URI;
if (!URI) { console.error('MONGODB_URI manquant'); process.exit(1); }

async function main() {
  await mongoose.connect(URI, { bufferCommands: false });
  const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }), 'orders');
  const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }), 'products');

  const products = await Product.find({}, { name: 1, images: 1 }).lean();
  const pmap = new Map(products.map((p) => [String(p._id), { name: p.name, img: p.images?.[0]?.url ?? null }]));

  const orders = await Order.find({ 'items.name': '' }).lean();
  let fixed = 0, itemsFixed = 0;
  for (const o of orders) {
    let changed = false;
    const items = (o.items || []).map((it) => {
      if (it.name && it.imageUrl) return it;
      const p = pmap.get(String(it.productId));
      if (!p) return it;
      const next = { ...it };
      if (!next.name) next.name = p.name ?? '';
      if (!next.imageUrl && p.img) next.imageUrl = p.img;
      if (next.name !== it.name || next.imageUrl !== it.imageUrl) { changed = true; itemsFixed++; }
      return next;
    });
    if (changed) { await Order.updateOne({ _id: o._id }, { $set: { items } }); fixed++; console.log('fixed', o.number); }
  }
  console.log(`\nDone. ${fixed} orders, ${itemsFixed} items backfilled.`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
