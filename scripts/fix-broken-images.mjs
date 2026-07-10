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
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dhugyagpb';

if (!URI) { console.error('MONGODB_URI is missing'); process.exit(1); }

async function findCorrectUrl(publicId) {
  const extensions = ['.png', '.jpg', '.jpeg', '.webp', ''];
  for (const ext of extensions) {
    const testUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${publicId}${ext}`;
    try {
      const res = await fetch(testUrl, { method: 'HEAD' });
      if (res.ok) {
        console.log(`  ✓ Resolved: ${testUrl}`);
        return testUrl;
      }
    } catch (err) {
      // ignore network errors and try next
    }
  }
  // Fallback if none works, just use without extension
  const fallbackUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${publicId}`;
  console.log(`  ⚠ Fallback: ${fallbackUrl}`);
  return fallbackUrl;
}

async function main() {
  await mongoose.connect(URI, { bufferCommands: false });
  const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }), 'products');
  const products = await Product.find({}).lean();
  
  let updatedCount = 0;

  for (const p of products) {
    let modified = false;
    const newImages = [];

    if (p.images && p.images.length > 0) {
      for (const img of p.images) {
        if (img.url && !img.url.startsWith('http') && !img.url.startsWith('/')) {
          console.log(`Product "${p.name}" has broken image: "${img.url}"`);
          const correctUrl = await findCorrectUrl(img.url);
          newImages.push({
            url: correctUrl,
            alt: img.alt || ''
          });
          modified = true;
        } else {
          newImages.push(img);
        }
      }
    }

    let newHoverImage = p.hoverImage;
    if (p.hoverImage && !p.hoverImage.startsWith('http') && !p.hoverImage.startsWith('/')) {
      console.log(`Product "${p.name}" has broken hoverImage: "${p.hoverImage}"`);
      newHoverImage = await findCorrectUrl(p.hoverImage);
      modified = true;
    }

    let newBundles = [];
    if (p.bundles && p.bundles.length > 0) {
      for (const b of p.bundles) {
        if (b.imageUrl && !b.imageUrl.startsWith('http') && !b.imageUrl.startsWith('/')) {
          console.log(`Product "${p.name}" bundle "${b.name}" has broken imageUrl: "${b.imageUrl}"`);
          const correctUrl = await findCorrectUrl(b.imageUrl);
          newBundles.push({
            ...b,
            imageUrl: correctUrl
          });
          modified = true;
        } else {
          newBundles.push(b);
        }
      }
    } else {
      newBundles = p.bundles;
    }

    if (modified) {
      const updateData = {};
      if (p.images && p.images.length > 0) updateData.images = newImages;
      if (p.hoverImage) updateData.hoverImage = newHoverImage;
      if (p.bundles && p.bundles.length > 0) updateData.bundles = newBundles;

      await Product.updateOne({ _id: p._id }, { $set: updateData });
      console.log(`Updated product "${p.name}" in database.`);
      updatedCount++;
    }
  }

  console.log(`\nMigration completed. ${updatedCount} products updated.`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
