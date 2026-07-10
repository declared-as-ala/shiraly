import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
function loadEnv(file) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv('.env.local'); loadEnv('.env');
const URI = process.env.MONGODB_URI;
if (!URI) { console.error('MONGODB_URI is missing'); process.exit(1); }

async function main() {
  await mongoose.connect(URI, { bufferCommands: false });
  const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }), 'products');
  const products = await Product.find({}, { name: 1, images: 1, hoverImage: 1, bundles: 1 }).lean();
  
  console.log(`Found ${products.length} products total.`);
  for (const p of products) {
    console.log(`\nProduct: "${p.name}" (ID: ${p._id})`);
    if (p.images && p.images.length > 0) {
      console.log('  Images:');
      p.images.forEach((img, idx) => {
        console.log(`    [${idx}] URL: "${img.url}" (Alt: "${img.alt ?? ''}")`);
      });
    } else {
      console.log('  Images: None');
    }
    if (p.hoverImage) {
      console.log(`  Hover Image: "${p.hoverImage}"`);
    }
    if (p.bundles && p.bundles.length > 0) {
      console.log('  Bundles:');
      p.bundles.forEach((b, idx) => {
        if (b.imageUrl) {
          console.log(`    [${idx}] Bundle "${b.name}" Image URL: "${b.imageUrl}"`);
        }
      });
    }
  }
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
