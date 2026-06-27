import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { promoService } from '@/services';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const promo = await promoService.toggleActive(params.id);
    return NextResponse.json(promo);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'toggle failed' }, { status: 500 });
  }
}
