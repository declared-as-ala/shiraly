import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { promoService } from '@/services';
import type { PromoCodeUpdateInput } from '@/types';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const promo = await promoService.getById(params.id);
    if (!promo) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const totalDiscount = await promoService.getTotalDiscount(params.id);
    const orders = await promoService.findOrdersByPromo(promo.code);
    return NextResponse.json({ ...promo, totalDiscount, orders });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'not found' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const body = (await req.json()) as PromoCodeUpdateInput;
    if (body.type === 'PERCENTAGE' && body.value !== undefined && (body.value <= 0 || body.value > 100)) {
      return NextResponse.json({ error: 'Le pourcentage doit être entre 1 et 100.' }, { status: 400 });
    }
    const promo = await promoService.update(params.id, body);
    return NextResponse.json(promo);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'update failed' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    await promoService.remove(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'delete failed' }, { status: 500 });
  }
}
