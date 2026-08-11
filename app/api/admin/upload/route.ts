import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';

/**
 * Upload an image.
 * Primary:  ImageKit  (free — 20 GB storage + 20 GB bandwidth/month)
 * Fallback: WordPress media library (if WP_* env vars are set)
 *
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
  const buffer = Buffer.from(arrayBuf);

  // ── ImageKit (primary) ─────────────────────────────────────────────────────
  const ikPrivateKey   = process.env.IMAGEKIT_PRIVATE_KEY;
  const ikUrlEndpoint  = process.env.IMAGEKIT_URL_ENDPOINT;

  if (ikPrivateKey && ikUrlEndpoint) {
    try {
      const base64 = buffer.toString('base64');
      const auth = Buffer.from(`${ikPrivateKey}:`).toString('base64');
      const safeName = file.name.replace(/[^\w.\-]/g, '_') || `upload-${Date.now()}.jpg`;

      const body = new URLSearchParams();
      body.set('file', `data:${file.type || 'image/jpeg'};base64,${base64}`);
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

      const data = await res.json().catch(() => ({})) as { fileId?: string; url?: string; message?: string };
      if (res.ok && data.url) {
        return NextResponse.json({ id: data.fileId ?? data.url, url: data.url });
      }
      console.error('[upload] ImageKit error:', data.message);
    } catch (err) {
      console.error('[upload] ImageKit exception:', err);
    }
  }

  // ── WordPress fallback ─────────────────────────────────────────────────────
  const wpUser = process.env.WP_ADMIN_USER;
  const wpPass = process.env.WP_APP_PASSWORD;
  const wpBase = (process.env.WC_API_URL ?? '').replace(/\/+$/, '');

  if (wpUser && wpPass && wpBase) {
    const safeName = file.name.replace(/[^\w.\-]/g, '_') || `upload-${Date.now()}.jpg`;
    const auth = Buffer.from(`${wpUser}:${wpPass.replace(/\s/g, '')}`).toString('base64');

    const wpRes = await fetch(`${wpBase}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': file.type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeName}"`,
      },
      body: buffer,
    });

    const text = await wpRes.text();
    let json: { id?: number; source_url?: string; message?: string };
    try { json = JSON.parse(text) as typeof json; } catch { json = { message: text.slice(0, 300) }; }

    if (wpRes.ok && json.id && json.source_url) {
      return NextResponse.json({ id: String(json.id), url: json.source_url });
    }
    return NextResponse.json(
      { error: json.message ?? `Upload failed (${wpRes.status})` },
      { status: wpRes.status || 500 },
    );
  }

  return NextResponse.json({
    error: "Aucun service d'upload configuré. Ajoutez IMAGEKIT_PRIVATE_KEY et IMAGEKIT_URL_ENDPOINT dans .env.local",
  }, { status: 500 });
}
