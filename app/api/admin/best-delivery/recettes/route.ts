import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { getRecette } from '@/lib/best-delivery';

/** GET /api/admin/best-delivery/recettes?page=1&ofset=20 */
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const ofset = Math.max(1, Number(searchParams.get('ofset')) || 20);
    const result = await getRecette(page, ofset);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Échec Best Delivery';
    console.error('[best-delivery] getRecette failed:', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
