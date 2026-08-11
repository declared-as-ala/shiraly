/**
 * migrate-to-imagekit.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * One-shot migration: Cloudinary → ImageKit
 *
 * What it does:
 *   1. Reads every product (images, hoverImage, bundle images) + category images
 *      + hero slides from MongoDB.
 *   2. For each Cloudinary URL, downloads the image buffer using the Cloudinary
 *      Admin API (works even when the CDN is disabled / account suspended).
 *   3. Uploads the buffer to ImageKit via their simple REST API.
 *   4. Replaces the URL in MongoDB with the new ImageKit URL.
 *
 * Setup (one-time):
 *   1. Sign up free at https://imagekit.io  (no credit card needed)
 *   2. In ImageKit dashboard → Developer Options → copy:
 *        - Public Key     → IMAGEKIT_PUBLIC_KEY
 *        - Private Key    → IMAGEKIT_PRIVATE_KEY
 *        - URL Endpoint   → IMAGEKIT_URL_ENDPOINT  (e.g. https://ik.imagekit.io/yourname)
 *   3. Add those three vars to your .env.local
 *   4. Run:  node scripts/migrate-to-imagekit.mjs
 *
 * Usage:
 *   node scripts/migrate-to-imagekit.mjs
 *   node scripts/migrate-to-imagekit.mjs --dry-run   (preview only, no writes)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY_RUN = process.argv.includes('--dry-run');

// ─── Load .env.local ─────────────────────────────────────────────────────────
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

// ─── Config validation ────────────────────────────────────────────────────────
const MONGODB_URI       = process.env.MONGODB_URI;
const CLOUD_NAME        = process.env.CLOUDINARY_CLOUD_NAME || 'dhugyagpb';
const CLOUDINARY_KEY    = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_SECRET = process.env.CLOUDINARY_API_SECRET;
const IK_PRIVATE_KEY    = process.env.IMAGEKIT_PRIVATE_KEY;
const IK_URL_ENDPOINT   = process.env.IMAGEKIT_URL_ENDPOINT; // e.g. https://ik.imagekit.io/yourname

if (!MONGODB_URI)    { console.error('❌ MONGODB_URI missing in .env.local'); process.exit(1); }
if (!IK_PRIVATE_KEY) { console.error('❌ IMAGEKIT_PRIVATE_KEY missing — sign up at https://imagekit.io and add to .env.local'); process.exit(1); }
if (!IK_URL_ENDPOINT){ console.error('❌ IMAGEKIT_URL_ENDPOINT missing — e.g. https://ik.imagekit.io/youraccountname'); process.exit(1); }

if (DRY_RUN) console.log('🔍 DRY RUN — no changes will be saved.\n');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns true if a URL belongs to this Cloudinary account */
function isCloudinaryUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return url.includes('res.cloudinary.com') || url.includes(`/${CLOUD_NAME}/`);
}

/**
 * Download image buffer from Cloudinary using signed Admin API URL.
 * Works even when CDN delivery is disabled.
 */
async function downloadFromCloudinary(url) {
  // Extract public_id from URL: everything after /upload/ (strip version + extension)
  // e.g. https://res.cloudinary.com/dhugyagpb/image/upload/v1234/shiraly/foo.jpg → shiraly/foo
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)$/);
  if (!match) throw new Error(`Cannot parse public_id from: ${url}`);

  let publicId = match[1];
  // Remove extension
  publicId = publicId.replace(/\.[^.]+$/, '');

  // Build a signed Cloudinary download URL using API credentials
  // (bypasses CDN — uses the API server directly)
  if (CLOUDINARY_KEY && CLOUDINARY_SECRET) {
    const timestamp = Math.floor(Date.now() / 1000);
    const toSign = `public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_SECRET}`;
    const { createHash } = await import('node:crypto');
    const signature = createHash('sha256').update(toSign).digest('hex');

    const apiUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/download`
      + `?public_id=${encodeURIComponent(publicId)}`
      + `&timestamp=${timestamp}`
      + `&api_key=${CLOUDINARY_KEY}`
      + `&signature=${signature}`;

    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`Cloudinary download failed (${res.status}) for ${publicId}`);
    return { buffer: Buffer.from(await res.arrayBuffer()), filename: path.basename(url) };
  }

  // Fallback: try direct URL (may work if image is cached somewhere)
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Direct download failed (${res.status}) for ${url}`);
  return { buffer: Buffer.from(await res.arrayBuffer()), filename: path.basename(url) };
}

/**
 * Upload a buffer to ImageKit and return the new URL.
 */
async function uploadToImageKit(buffer, filename) {
  const FormData = (await import('node:buffer')).Blob ? globalThis.FormData : null;

  // Use multipart form via fetch
  const base64 = buffer.toString('base64');
  const auth = Buffer.from(`${IK_PRIVATE_KEY}:`).toString('base64');

  const body = new URLSearchParams();
  body.set('file', `data:image/jpeg;base64,${base64}`);
  body.set('fileName', filename || `shiraly-${Date.now()}.jpg`);
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

// Cache to avoid re-uploading the same Cloudinary URL twice
const urlCache = new Map();

async function migrateUrl(oldUrl) {
  if (!isCloudinaryUrl(oldUrl)) return null; // Not a Cloudinary URL — skip

  if (urlCache.has(oldUrl)) {
    console.log(`  ↩  Cache hit: ${oldUrl.slice(-40)}`);
    return urlCache.get(oldUrl);
  }

  try {
    console.log(`  ⬇  Downloading: ${oldUrl.slice(-60)}`);
    const { buffer, filename } = await downloadFromCloudinary(oldUrl);

    console.log(`  ⬆  Uploading to ImageKit (${Math.round(buffer.length / 1024)} KB)...`);
    const newUrl = DRY_RUN ? `DRY_RUN:${oldUrl}` : await uploadToImageKit(buffer, filename);

    urlCache.set(oldUrl, newUrl);
    console.log(`  ✅ ${newUrl}`);
    return newUrl;
  } catch (err) {
    console.error(`  ❌ Failed for ${oldUrl}: ${err.message}`);
    return null; // Keep original URL on failure
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

  // ── Products ────────────────────────────────────────────────────────────────
  console.log('━━━ Products ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const products = await Product.find({}).lean();
  console.log(`Found ${products.length} products.\n`);

  for (const p of products) {
    console.log(`📦 "${p.name || p._id}"`);
    const update = {};
    let changed = false;

    // images[]
    if (Array.isArray(p.images) && p.images.length > 0) {
      const newImages = [];
      for (const img of p.images) {
        const newUrl = await migrateUrl(img.url);
        if (newUrl && newUrl !== img.url) { changed = true; totalMigrated++; }
        else if (newUrl === null && isCloudinaryUrl(img.url)) totalFailed++;
        newImages.push({ ...img, url: newUrl ?? img.url });
      }
      if (changed) update.images = newImages;
    }

    // hoverImage
    if (p.hoverImage) {
      const newUrl = await migrateUrl(p.hoverImage);
      if (newUrl && newUrl !== p.hoverImage) { update.hoverImage = newUrl; changed = true; totalMigrated++; }
      else if (newUrl === null && isCloudinaryUrl(p.hoverImage)) totalFailed++;
    }

    // bundles[].imageUrl
    if (Array.isArray(p.bundles) && p.bundles.length > 0) {
      const newBundles = [];
      for (const b of p.bundles) {
        if (!b.imageUrl) { newBundles.push(b); continue; }
        const newUrl = await migrateUrl(b.imageUrl);
        if (newUrl && newUrl !== b.imageUrl) { changed = true; totalMigrated++; }
        else if (newUrl === null && isCloudinaryUrl(b.imageUrl)) totalFailed++;
        newBundles.push({ ...b, imageUrl: newUrl ?? b.imageUrl });
      }
      if (changed) update.bundles = newBundles;
    }

    if (changed && !DRY_RUN) {
      await Product.updateOne({ _id: p._id }, { $set: update });
      console.log(`  💾 Saved.\n`);
    } else if (changed) {
      console.log(`  🔍 (dry-run — would save)\n`);
    } else {
      console.log(`  ⏭  No Cloudinary images — skipped.\n`);
    }
  }

  // ── Categories ──────────────────────────────────────────────────────────────
  console.log('━━━ Categories ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const categories = await Category.find({}).lean();
  console.log(`Found ${categories.length} categories.\n`);

  for (const c of categories) {
    console.log(`📂 "${c.name || c._id}"`);
    if (!c.imageUrl || !isCloudinaryUrl(c.imageUrl)) { console.log('  ⏭  Skipped.\n'); continue; }
    const newUrl = await migrateUrl(c.imageUrl);
    if (newUrl && newUrl !== c.imageUrl) {
      if (!DRY_RUN) await Category.updateOne({ _id: c._id }, { $set: { imageUrl: newUrl } });
      totalMigrated++;
      console.log(`  💾 Saved.\n`);
    } else if (newUrl === null) {
      totalFailed++;
    }
  }

  // ── Site Settings (hero slides, profile photo) ──────────────────────────────
  console.log('━━━ Site Settings ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const settings = await SiteSetting.find({}).lean();

  for (const s of settings) {
    // hero_slides
    if (s.key === 'hero_slides' && Array.isArray(s.value)) {
      console.log('📑 hero_slides');
      let changed = false;
      const newSlides = [];
      for (const slide of s.value) {
        if (!slide.imageUrl) { newSlides.push(slide); continue; }
        const newUrl = await migrateUrl(slide.imageUrl);
        if (newUrl && newUrl !== slide.imageUrl) { changed = true; totalMigrated++; }
        else if (newUrl === null && isCloudinaryUrl(slide.imageUrl)) totalFailed++;
        newSlides.push({ ...slide, imageUrl: newUrl ?? slide.imageUrl });
      }
      if (changed && !DRY_RUN) {
        await SiteSetting.updateOne({ _id: s._id }, { $set: { value: newSlides } });
        console.log('  💾 Saved.\n');
      }
    }

    // site_settings.photoUrl
    if (s.key === 'site_settings' && s.value?.photoUrl) {
      console.log('🖼  site_settings.photoUrl');
      const newUrl = await migrateUrl(s.value.photoUrl);
      if (newUrl && newUrl !== s.value.photoUrl) {
        if (!DRY_RUN) {
          await SiteSetting.updateOne({ _id: s._id }, { $set: { 'value.photoUrl': newUrl } });
        }
        totalMigrated++;
        console.log('  💾 Saved.\n');
      }
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(`✅ Migrated: ${totalMigrated} images`);
  console.log(`❌ Failed:   ${totalFailed} images`);
  if (DRY_RUN) console.log('(DRY RUN — nothing was written to MongoDB)');
  console.log('══════════════════════════════════════════════════════════════════\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
