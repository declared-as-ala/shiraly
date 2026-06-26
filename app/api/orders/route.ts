import { NextResponse } from 'next/server';
import { orderService } from '@/services';
import type { CheckoutPayload } from '@/types';

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

    if (orderId) {
      // Update existing order (e.g. update form details or finalize status)
      const order = await orderService.update(orderId, {
        status: payload.status,
        customer: payload.customer,
        shipping: payload.shipping,
        subtotal: payload.subtotal,
        total: payload.total,
        attempts: payload.attempts,
        items: payload.items.map((i) => ({
          productId: i.productId,
          qty: i.qty,
          unitPrice: i.price,
          variation: i.variation,
          bundleName: i.bundleName,
          bundleSlot: i.bundleSlot,
        })),
      });
      return NextResponse.json({ id: order.id, number: order.number, total: order.total });
    } else {
      // Create new order
      const order = await orderService.create(payload);
      return NextResponse.json({ id: order.id, number: order.number, total: order.total });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'order creation/update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
