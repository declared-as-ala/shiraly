import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { promoService } from '@/services';
import type { PromoCodeCreateInput } from '@/types';

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const query = {
      page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
      perPage: searchParams.get('perPage') ? Number(searchParams.get('perPage')) : undefined,
      search: searchParams.get('search') || undefined,
      active: searchParams.has('active') ? searchParams.get('active') === 'true' : undefined,
      type: searchParams.get('type') as 'PERCENTAGE' | 'FIXED_AMOUNT' | undefined,
      expired: searchParams.has('expired') ? searchParams.get('expired') === 'true' : undefined,
      sort: searchParams.get('sort') || undefined,
      order: searchParams.get('order') as 'asc' | 'desc' | undefined,
    };
    const result = await promoService.list(query);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'list failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const body = (await req.json()) as PromoCodeCreateInput;
    if (!body.code || !body.type || body.value === undefined) {
      return NextResponse.json({ error: 'Code, type et valeur requis.' }, { status: 400 });
    }
    if (body.type === 'PERCENTAGE' && (body.value <= 0 || body.value > 100)) {
      return NextResponse.json({ error: 'Le pourcentage doit être entre 1 et 100.' }, { status: 400 });
    }
    if (body.type === 'FIXED_AMOUNT' && body.value <= 0) {
      return NextResponse.json({ error: 'La valeur doit être supérieure à 0.' }, { status: 400 });
    }
    const promo = await promoService.create(body);
    return NextResponse.json(promo);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'create failed';
    if (msg.includes('duplicate') || msg.includes('E11000')) {
      return NextResponse.json({ error: 'Ce code promo existe déjà.' }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
