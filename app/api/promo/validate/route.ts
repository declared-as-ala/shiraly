import { NextResponse } from 'next/server';
import { promoService } from '@/services';
import type { CartItem } from '@/types';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, items } = body as { code?: string; items?: CartItem[] };

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ valid: false, error: 'Code promo requis.' }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ valid: false, error: 'Panier vide.' }, { status: 400 });
    }

    const subtotal = items.reduce((s, x) => s + x.price * x.qty, 0);
    const result = await promoService.validateAndApply(code, { items, subtotal });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { valid: false, error: e instanceof Error ? e.message : 'Erreur de validation' },
      { status: 500 },
    );
  }
}
