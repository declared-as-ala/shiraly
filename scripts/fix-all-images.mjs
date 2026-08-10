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

if (!URI) {
  console.error('MONGODB_URI is missing');
  process.exit(1);
}

function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return url;
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
    return trimmed;
  }
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${trimmed}`;
}

async function main() {
  await mongoose.connect(URI, { bufferCommands: false });
  console.log('Connected to MongoDB.');

  // 1. Products
  const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }), 'products');
  const products = await Product.find({}).lean();
  let updatedProducts = 0;

  for (const p of products) {
    let modified = false;
    const updateData = {};

    if (Array.isArray(p.images) && p.images.length > 0) {
      const newImages = p.images.map((img) => {
        const norm = normalizeUrl(img.url);
        if (norm !== img.url) modified = true;
        return { ...img, url: norm };
      });
      if (modified) updateData.images = newImages;
    }

    if (p.hoverImage) {
      const normHover = normalizeUrl(p.hoverImage);
      if (normHover !== p.hoverImage) {
        updateData.hoverImage = normHover;
        modified = true;
      }
    }

    if (Array.isArray(p.bundles) && p.bundles.length > 0) {
      const newBundles = p.bundles.map((b) => {
        if (!b.imageUrl) return b;
        const norm = normalizeUrl(b.imageUrl);
        if (norm !== b.imageUrl) modified = true;
        return { ...b, imageUrl: norm };
      });
      if (modified) updateData.bundles = newBundles;
    }

    if (modified) {
      await Product.updateOne({ _id: p._id }, { $set: updateData });
      console.log(`Updated product: "${p.name}"`);
      updatedProducts++;
    }
  }

  // 2. SiteSettings (hero_slides, etc.)
  const SiteSetting = mongoose.model('SiteSetting', new mongoose.Schema({}, { strict: false }), 'site_settings');
  const settings = await SiteSetting.find({}).lean();
  let updatedSettings = 0;

  for (const s of settings) {
    if (s.key === 'hero_slides' && Array.isArray(s.value)) {
      let modified = false;
      const newSlides = s.value.map((slide) => {
        if (!slide.imageUrl) return slide;
        const norm = normalizeUrl(slide.imageUrl);
        if (norm !== slide.imageUrl) modified = true;
        return { ...slide, imageUrl: norm };
      });
      if (modified) {
        await SiteSetting.updateOne({ _id: s._id }, { $set: { value: newSlides } });
        console.log('Updated hero_slides setting.');
        updatedSettings++;
      }
    }
  }

  console.log(`Migration finished. ${updatedProducts} products and ${updatedSettings} settings updated.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
