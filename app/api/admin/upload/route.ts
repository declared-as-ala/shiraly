import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload an image.
 * Tries Cloudinary first (if configured), falls back to WordPress media library.
 * Returns: { id, url }
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get('file');
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'Fichier > 8 MB' }, { status: 400 });

  const arrayBuf = await file.arrayBuffer();

  // Try Cloudinary
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    try {
      const b64 = Buffer.from(arrayBuf).toString('base64');
      const dataUri = `data:${file.type || 'image/jpeg'};base64,${b64}`;
      const result = await cloudinary.uploader.upload(dataUri, {
        folder: 'shiraly',
        resource_type: 'image',
      });
      return NextResponse.json({ id: result.public_id, url: result.secure_url });
    } catch {
      // fallback to WP
    }
  }

  // Fallback: WordPress media library
  const user = process.env.WP_ADMIN_USER;
  const pass = process.env.WP_APP_PASSWORD;
  const wpBase = (process.env.WC_API_URL ?? '').replace(/\/+$/, '');
  if (!user || !pass || !wpBase) {
    return NextResponse.json({
      error: 'Aucun service d\'upload configuré. Configurez Cloudinary ou WordPress.',
    }, { status: 500 });
  }

  const safeName = file.name.replace(/[^\w.\-]/g, '_') || `upload-${Date.now()}.jpg`;
  const auth = Buffer.from(`${user}:${pass.replace(/\s/g, '')}`).toString('base64');

  const wpRes = await fetch(`${wpBase}/wp-json/wp/v2/media`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': file.type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safeName}"`,
    },
    body: Buffer.from(arrayBuf),
  });

  const text = await wpRes.text();
  let json: { id?: number; source_url?: string; message?: string };
  try { json = JSON.parse(text) as typeof json; } catch { json = { message: text.slice(0, 300) }; }

  if (!wpRes.ok || !json.id || !json.source_url) {
    return NextResponse.json(
      { error: json.message ?? `Upload failed (${wpRes.status})` },
      { status: wpRes.status || 500 },
    );
  }
  return NextResponse.json({ id: String(json.id), url: json.source_url });
}
