import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { orderService } from '@/services';
import { createPickup, type CreatePickupInput } from '@/lib/best-delivery';

/**
 * POST /api/admin/best-delivery/pickup  { orderId }
 * Creates a Best Delivery parcel for an existing order and persists the
 * returned tracking number + label URL. Never throws on provider failure —
 * the order is marked delivery.failed so it can be retried.
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const { orderId } = await req.json();
    if (!orderId) return NextResponse.json({ error: 'orderId requis' }, { status: 400 });

    const order = await orderService.getById(orderId);
    if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });

    // Include the chosen size/color (line attributes) so they appear on the
    // Best Delivery bordereau, e.g. "KAMRAYA PANTS (Size: M) x2".
    const designation =
      order.items.map((i) => {
        const opts = (i.attributes ?? [])
          .filter((a) => a.value && a.value !== '—')
          .map((a) => (/^offre$/i.test(a.key) || /^item\s*\d+/i.test(a.key) ? a.value : `${a.key}: ${a.value}`))
          .join(' · ');
        const qty = i.quantity > 1 ? ` x${i.quantity}` : '';
        return `${i.name}${opts ? ` (${opts})` : ''}${qty}`;
      }).join(', ').slice(0, 250)
      || `Commande ${order.number}`;

    const input: CreatePickupInput = {
      nom: `${order.customer.firstName} ${order.customer.lastName ?? ''}`.trim(),
      gouvernerat: order.customer.city,   // Tunisian COD stores the governorate as "city"
      ville: order.customer.city,
      adresse: order.customer.address,
      tel: order.customer.phone,
      tel2: order.customer.phone2 || undefined,
      designation,
      prix: order.total,
      msg: order.customer.note || undefined,
      echange: 0,
    };

    const result = await createPickup(input);
    const now = new Date().toISOString();

    if (result.hasErrors) {
      await orderService.update(orderId, {
        delivery: { provider: 'best_delivery', failed: true, error: result.errorsTxt, payload: result.raw as Record<string, unknown> | null, lastSyncAt: now },
      });
      return NextResponse.json({ ok: false, error: result.errorsTxt ?? 'Échec de création', delivery: { failed: true } }, { status: 422 });
    }

    const updated = await orderService.update(orderId, {
      deliveryCompany: 'best_delivery',
      delivery: {
        provider: 'best_delivery',
        trackingNumber: result.codeBarre,
        labelUrl: result.url,
        failed: false,
        error: null,
        payload: result.raw as Record<string, unknown> | null,
        lastSyncAt: now,
      },
    });

    return NextResponse.json({ ok: true, delivery: updated.delivery });
  } catch (e) {
    // Network/SOAP failure — do not break order management; surface for retry.
    const msg = e instanceof Error ? e.message : 'Échec Best Delivery';
    console.error('[best-delivery] pickup failed:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
