import { NextResponse } from 'next/server';
import { orderService, promoService } from '@/services';
import type { CheckoutPayload, CartItem } from '@/types';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId, ...payload } = body as CheckoutPayload & { orderId?: string };

    if (!payload?.customer?.phone || !payload?.customer?.firstName) {
      return NextResponse.json({ error: 'Nom et téléphone obligatoires.' }, { status: 400 });
    }
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      return NextResponse.json({ error: 'Panier vide.' }, { status: 400 });
    }

    // Server-side recalculate subtotal
    const recalculatedSubtotal = payload.items.reduce((s: number, x: CartItem) => s + x.price * x.qty, 0);
    const shipping = payload.shipping ?? 8;

    // Handle promo code if present
    let discountAmount = 0;
    let promoCode: string | null = null;

    if (payload.promoCode) {
      const result = await promoService.validateAndApply(payload.promoCode, {
        items: payload.items as CartItem[],
        subtotal: recalculatedSubtotal,
      });
      if (result.valid && result.discountAmount) {
        discountAmount = result.discountAmount;
        promoCode = result.code;
      }
    }

    const recalculatedTotal = Math.max(0, recalculatedSubtotal + shipping - discountAmount);

    if (orderId) {
      const order = await orderService.update(orderId, {
        status: payload.status,
        customer: payload.customer,
        shipping,
        subtotal: recalculatedSubtotal,
        total: recalculatedTotal,
        attempts: payload.attempts,
        promoCode,
        discountAmount,
        finalTotal: recalculatedTotal,
        items: payload.items.map((i: CartItem) => ({
          productId: i.productId,
          qty: i.qty,
          unitPrice: i.price,
          variation: i.variation,
          bundleName: i.bundleName,
          bundleSlot: i.bundleSlot,
        })),
      });
      return NextResponse.json({ id: order.id, number: order.number, total: recalculatedTotal });
    } else {
      const order = await orderService.create({
        ...payload,
        subtotal: recalculatedSubtotal,
        total: recalculatedTotal,
        shipping,
      }, promoCode, discountAmount);
      // Increment promo usage count on successful order
      if (promoCode) {
        const promo = await promoService.getByCode(promoCode);
        if (promo) {
          await promoService.incrementUsage(promo.id);
        }
      }
      return NextResponse.json({ id: order.id, number: order.number, total: recalculatedTotal });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'order creation/update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
