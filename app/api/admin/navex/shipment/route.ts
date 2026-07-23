import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { withDeliveryLock, alreadySentResponse } from '@/lib/delivery-idempotency';
import { buildNavexDesignation, navex, navexConfigured } from '@/lib/navex';
import { orderService } from '@/services';

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!navexConfigured) return NextResponse.json({ error: 'Navex non configuré' }, { status: 503 });

  const { orderId } = await req.json().catch(() => ({}));
  if (!orderId) return NextResponse.json({ error: 'orderId requis' }, { status: 400 });

  return withDeliveryLock(`navex:${orderId}`, async () => {
    const order = await orderService.getById(String(orderId));
    if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });

    const existing = order.delivery;
    if (existing?.trackingNumber && existing.provider === 'navex') {
      return NextResponse.json({ ...alreadySentResponse(existing.trackingNumber), delivery: existing });
    }
    if (existing?.trackingNumber && existing.provider && existing.provider !== 'navex') {
      return NextResponse.json({ error: `Commande déjà envoyée à ${existing.provider}` }, { status: 409 });
    }

    const { designation, nbArticle } = buildNavexDesignation(order.items);
    const result = await navex.createShipment({
      reference: `#${order.number}`,
      receiverName: `${order.customer.firstName} ${order.customer.lastName ?? ''}`.trim(),
      receiverPhone: order.customer.phone,
      receiverPhone2: order.customer.phone2,
      receiverGov: order.customer.city,
      receiverCity: order.customer.city,
      receiverAddress: order.customer.address,
      codAmount: order.total,
      itemsCount: nbArticle,
      productLabel: designation,
      note: order.customer.note,
      exchange: false,
    });
    const now = new Date().toISOString();

    if (!result.ok || !result.barcode) {
      const updated = await orderService.update(order.id, {
        delivery: {
          provider: 'navex', failed: true, error: result.error ?? 'Échec de création Navex',
          payload: asPayload(result.raw), lastSyncAt: now,
        },
      });
      return NextResponse.json({ ok: false, error: result.error, delivery: updated.delivery }, { status: 422 });
    }

    const updated = await orderService.update(order.id, {
      deliveryCompany: 'navex',
      delivery: {
        provider: 'navex', trackingNumber: result.barcode, labelUrl: result.labelUrl ?? null,
        statusCode: 'created', statusMessage: 'Créé chez Navex', failed: false, error: null,
        payload: asPayload(result.raw), lastSyncAt: now,
      },
    });
    return NextResponse.json({ ok: true, barcode: result.barcode, delivery: updated.delivery });
  });
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { orderId } = await req.json().catch(() => ({}));
  if (!orderId) return NextResponse.json({ error: 'orderId requis' }, { status: 400 });

  return withDeliveryLock(`navex:${orderId}`, async () => {
    const order = await orderService.getById(String(orderId));
    if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
    if (order.delivery?.provider !== 'navex' || !order.delivery.trackingNumber) {
      return NextResponse.json({ error: 'Aucun colis Navex pour cette commande' }, { status: 400 });
    }
    const result = await navex.deleteShipment(order.delivery.trackingNumber);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error ?? 'Échec de suppression Navex' }, { status: 422 });

    const updated = await orderService.update(order.id, {
      delivery: {
        statusCode: 'deleted', statusMessage: 'Supprimé chez Navex', failed: false, error: null,
        payload: asPayload(result.raw), lastSyncAt: new Date().toISOString(),
      },
    });
    return NextResponse.json({ ok: true, delivery: updated.delivery });
  });
}

function asPayload(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return raw == null ? null : { response: raw };
}
