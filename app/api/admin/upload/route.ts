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

  // ── Base64 encoding (stores directly in MongoDB without CDN bandwidth limits) ──
  const mimeType = file.type || 'image/jpeg';
  const base64 = buffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;
  const id = `b64_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return NextResponse.json({ id, url: dataUrl });
}

