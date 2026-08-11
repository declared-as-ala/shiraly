/**
 * migrate-to-imagekit.mjs  (v2 — Wayback Machine recovery)
 * ─────────────────────────────────────────────────────────
 * Since the Cloudinary account is fully suspended (API + CDN both 401),
 * this script recovers images from the Internet Archive (Wayback Machine)
 * and re-uploads them to ImageKit, then updates all URLs in MongoDB.
 *
 * Run:
 *   node scripts/migrate-to-imagekit.mjs            ← real run
 *   node scripts/migrate-to-imagekit.mjs --dry-run  ← preview only
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY_RUN = process.argv.includes('--dry-run');

// ─── Load env ────────────────────────────────────────────────────────────────
function loadEnv(file) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv('.env.local'); loadEnv('.env');

const MONGODB_URI      = process.env.MONGODB_URI;
const IK_PRIVATE_KEY   = process.env.IMAGEKIT_PRIVATE_KEY;
const IK_URL_ENDPOINT  = process.env.IMAGEKIT_URL_ENDPOINT;

if (!MONGODB_URI)    { console.error('❌ MONGODB_URI missing'); process.exit(1); }
if (!IK_PRIVATE_KEY) { console.error('❌ IMAGEKIT_PRIVATE_KEY missing'); process.exit(1); }
if (!IK_URL_ENDPOINT){ console.error('❌ IMAGEKIT_URL_ENDPOINT missing'); process.exit(1); }

if (DRY_RUN) console.log('🔍 DRY RUN — no changes will be saved.\n');

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isCloudinaryUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return url.includes('res.cloudinary.com') || url.includes('cloudinary.com');
}

/**
 * Try to download an image from multiple sources:
 * 1. Wayback Machine (Internet Archive) — most likely to have cached images
 * 2. Google Cache
 * 3. Direct URL (will fail if account suspended, but worth trying)
 */
async function downloadImage(originalUrl) {
  const filename = originalUrl.split('/').pop() || `image-${Date.now()}.jpg`;

  // ── Strategy 1: Wayback Machine ────────────────────────────────────────────
  // First, ask the availability API which snapshot is closest
  try {
    console.log(`  🕰  Checking Wayback Machine...`);
    const availUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(originalUrl)}`;
    const availRes = await fetch(availUrl, { signal: AbortSignal.timeout(10000) });
    const availData = await availRes.json();
    const snapshotUrl = availData?.archived_snapshots?.closest?.url;

    if (snapshotUrl) {
      // Convert to raw image URL (replace /web/TIMESTAMP/ with /web/TIMESTAMP_if_/)
      // The _if_ flag tells Wayback to return the raw file without the toolbar
      const rawUrl = snapshotUrl.replace(/\/web\/(\d+)\//, '/web/$1if_/');
      console.log(`  📦 Found snapshot: ${rawUrl.slice(0, 80)}...`);

      const imgRes = await fetch(rawUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ShiralyMigrator/1.0)' },
        signal: AbortSignal.timeout(20000),
      });

      if (imgRes.ok) {
        const buf = Buffer.from(await imgRes.arrayBuffer());
        if (buf.length > 1000) { // sanity check — real image, not an error page
          console.log(`  ✅ Downloaded from Wayback (${Math.round(buf.length / 1024)} KB)`);
          return { buffer: buf, filename };
        }
      }
    } else {
      console.log(`  ⚠  No Wayback snapshot found for this image.`);
    }
  } catch (err) {
    console.log(`  ⚠  Wayback Machine error: ${err.message}`);
  }

  // ── Strategy 2: Direct URL (may still work for some images) ────────────────
  try {
    console.log(`  🌐 Trying direct URL...`);
    const res = await fetch(originalUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 1000) {
        console.log(`  ✅ Downloaded directly (${Math.round(buf.length / 1024)} KB)`);
        return { buffer: buf, filename };
      }
    }
  } catch (err) {
    console.log(`  ⚠  Direct download failed: ${err.message}`);
  }

  return null;
}

/** Upload buffer to ImageKit, return new URL */
async function uploadToImageKit(buffer, filename) {
  const base64 = buffer.toString('base64');
  const auth = Buffer.from(`${IK_PRIVATE_KEY}:`).toString('base64');
  const safeName = filename.replace(/[^\w.\-]/g, '_');

  const body = new URLSearchParams();
  body.set('file', `data:image/jpeg;base64,${base64}`);
  body.set('fileName', safeName);
  body.set('folder', '/shiraly');
  body.set('useUniqueFileName', 'true');

  const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) {
    throw new Error(`ImageKit upload failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data.url;
}

// Cache — avoid re-downloading/uploading the same URL twice
const urlCache = new Map();

async function migrateUrl(oldUrl) {
  if (!isCloudinaryUrl(oldUrl)) return null;
  if (urlCache.has(oldUrl)) {
    const cached = urlCache.get(oldUrl);
    console.log(`  ↩  Cache hit → ${cached}`);
    return cached;
  }

  console.log(`  ⬇  Source: ${oldUrl.slice(-70)}`);
  const downloaded = await downloadImage(oldUrl);

  if (!downloaded) {
    console.log(`  ❌ Could not recover this image — will need manual re-upload.`);
    urlCache.set(oldUrl, null);
    return null;
  }

  if (DRY_RUN) {
    const fake = `https://ik.imagekit.io/w7uwj4ie2i/shiraly/${downloaded.filename}`;
    urlCache.set(oldUrl, fake);
    console.log(`  🔍 (dry-run) Would upload → ${fake}`);
    return fake;
  }

  try {
    console.log(`  ⬆  Uploading to ImageKit...`);
    const newUrl = await uploadToImageKit(downloaded.buffer, downloaded.filename);
    urlCache.set(oldUrl, newUrl);
    console.log(`  ✅ ImageKit URL: ${newUrl}`);
    return newUrl;
  } catch (err) {
    console.error(`  ❌ ImageKit upload error: ${err.message}`);
    urlCache.set(oldUrl, null);
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  await mongoose.connect(MONGODB_URI, { bufferCommands: false });
  console.log('✅ Connected to MongoDB\n');

  const Product     = mongoose.model('Product',     new mongoose.Schema({}, { strict: false }), 'products');
  const Category    = mongoose.model('Category',    new mongoose.Schema({}, { strict: false }), 'categories');
  const SiteSetting = mongoose.model('SiteSetting', new mongoose.Schema({}, { strict: false }), 'sitesettings');

  let totalMigrated = 0;
  let totalFailed   = 0;
  const failedImages = []; // track for manual re-upload

  // ── Products ────────────────────────────────────────────────────────────────
  console.log('━━━ Products ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const products = await Product.find({}).lean();
  console.log(`Found ${products.length} products.\n`);

  for (const p of products) {
    let productHasCloudinary = false;
    const images = Array.isArray(p.images) ? p.images : [];
    const bundles = Array.isArray(p.bundles) ? p.bundles : [];
    if (images.some(i => isCloudinaryUrl(i?.url))) productHasCloudinary = true;
    if (isCloudinaryUrl(p.hoverImage)) productHasCloudinary = true;
    if (bundles.some(b => isCloudinaryUrl(b?.imageUrl))) productHasCloudinary = true;
    if (!productHasCloudinary) {
      console.log(`📦 "${p.name || p._id}" — no Cloudinary images, skipping.\n`);
      continue;
    }

    console.log(`\n📦 "${p.name || p._id}"`);
    const update = {};
    let changed = false;

    // images[]
    if (images.length > 0) {
      const newImages = [];
      for (const img of images) {
        const newUrl = await migrateUrl(img.url);
        if (newUrl && newUrl !== img.url) { changed = true; totalMigrated++; }
        else if (newUrl === null && isCloudinaryUrl(img.url)) {
          totalFailed++;
          failedImages.push({ product: p.name, type: 'image', oldUrl: img.url });
        }
        newImages.push({ ...img, url: newUrl ?? img.url });
      }
      if (changed) update.images = newImages;
    }

    // hoverImage
    if (p.hoverImage) {
      const newUrl = await migrateUrl(p.hoverImage);
      if (newUrl && newUrl !== p.hoverImage) { update.hoverImage = newUrl; changed = true; totalMigrated++; }
      else if (newUrl === null && isCloudinaryUrl(p.hoverImage)) {
        totalFailed++;
        failedImages.push({ product: p.name, type: 'hoverImage', oldUrl: p.hoverImage });
      }
    }

    // bundles[].imageUrl
    if (bundles.length > 0) {
      let bundleChanged = false;
      const newBundles = [];
      for (const b of bundles) {
        if (!b.imageUrl) { newBundles.push(b); continue; }
        const newUrl = await migrateUrl(b.imageUrl);
        if (newUrl && newUrl !== b.imageUrl) { bundleChanged = true; changed = true; totalMigrated++; }
        else if (newUrl === null && isCloudinaryUrl(b.imageUrl)) {
          totalFailed++;
          failedImages.push({ product: p.name, type: 'bundle', oldUrl: b.imageUrl });
        }
        newBundles.push({ ...b, imageUrl: newUrl ?? b.imageUrl });
      }
      if (bundleChanged) update.bundles = newBundles;
    }

    if (changed && !DRY_RUN) {
      await Product.updateOne({ _id: p._id }, { $set: update });
      console.log(`  💾 MongoDB updated.\n`);
    } else if (changed) {
      console.log(`  🔍 (dry-run — would save)\n`);
    }
  }

  // ── Categories ──────────────────────────────────────────────────────────────
  console.log('\n━━━ Categories ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const categories = await Category.find({}).lean();
  for (const c of categories) {
    if (!isCloudinaryUrl(c.imageUrl)) continue;
    console.log(`\n📂 "${c.name}"`);
    const newUrl = await migrateUrl(c.imageUrl);
    if (newUrl && newUrl !== c.imageUrl) {
      if (!DRY_RUN) await Category.updateOne({ _id: c._id }, { $set: { imageUrl: newUrl } });
      totalMigrated++;
    } else if (!newUrl) {
      totalFailed++;
      failedImages.push({ product: `Category: ${c.name}`, type: 'imageUrl', oldUrl: c.imageUrl });
    }
  }

  // ── Site Settings ────────────────────────────────────────────────────────────
  console.log('\n━━━ Site Settings ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const settings = await SiteSetting.find({}).lean();
  for (const s of settings) {
    if (s.key === 'hero_slides' && Array.isArray(s.value)) {
      let changed = false;
      const newSlides = [];
      for (const slide of s.value) {
        if (!isCloudinaryUrl(slide.imageUrl)) { newSlides.push(slide); continue; }
        console.log(`\n📑 hero slide: ${slide.title || slide.id}`);
        const newUrl = await migrateUrl(slide.imageUrl);
        if (newUrl && newUrl !== slide.imageUrl) { changed = true; totalMigrated++; }
        else if (!newUrl) { totalFailed++; failedImages.push({ product: 'hero_slide', type: 'imageUrl', oldUrl: slide.imageUrl }); }
        newSlides.push({ ...slide, imageUrl: newUrl ?? slide.imageUrl });
      }
      if (changed && !DRY_RUN) await SiteSetting.updateOne({ _id: s._id }, { $set: { value: newSlides } });
    }
    if (s.key === 'site_settings' && isCloudinaryUrl(s.value?.photoUrl)) {
      console.log('\n🖼  site_settings.photoUrl');
      const newUrl = await migrateUrl(s.value.photoUrl);
      if (newUrl && !DRY_RUN) await SiteSetting.updateOne({ _id: s._id }, { $set: { 'value.photoUrl': newUrl } });
      if (newUrl) totalMigrated++; else totalFailed++;
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(`✅ Migrated to ImageKit: ${totalMigrated}`);
  console.log(`❌ Could not recover:   ${totalFailed} (need manual re-upload)`);
  if (DRY_RUN) console.log('ℹ  DRY RUN — nothing written.');
  console.log('══════════════════════════════════════════════════════════════════');

  if (failedImages.length > 0) {
    console.log('\n📋 Images that need MANUAL re-upload:');
    for (const f of failedImages) {
      console.log(`  • ${f.product} [${f.type}]`);
    }
    // Write a report file
    const report = failedImages.map(f =>
      `${f.product} | ${f.type} | ${f.oldUrl}`
    ).join('\n');
    fs.writeFileSync(path.join(root, 'scripts', 'failed-images-report.txt'), report);
    console.log('\n  → Full report saved to: scripts/failed-images-report.txt');
    console.log('  → Re-upload these manually in the admin panel: /admin/produits');
  }

  await mongoose.disconnect();
  console.log('\n✅ Done.\n');
}

main().catch(err => {
  console.error('\n❌ Fatal:', err.message);
  process.exit(1);
});
