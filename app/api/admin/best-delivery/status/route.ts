import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { orderService } from '@/services';
import { trackShipmentStatus } from '@/lib/best-delivery';

/**
 * POST /api/admin/best-delivery/status  { orderId }
 * Refreshes the current delivery status code/message and persists it.
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const { orderId } = await req.json();
    if (!orderId) return NextResponse.json({ error: 'orderId requis' }, { status: 400 });

    const order = await orderService.getById(orderId);
    if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });

    const tracking = order.delivery?.trackingNumber;
    if (!tracking) return NextResponse.json({ error: 'Aucun numéro de suivi pour cette commande' }, { status: 400 });

    const result = await trackShipmentStatus(tracking);
    if (result.hasErrors) {
      return NextResponse.json({ ok: false, error: result.errorsTxt ?? 'Erreur de suivi' }, { status: 422 });
    }

    const updated = await orderService.update(orderId, {
      delivery: {
        statusCode: result.statusCode,
        statusMessage: result.statusMessage,
        lastSyncAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ ok: true, delivery: updated.delivery });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Échec Best Delivery';
    console.error('[best-delivery] status failed:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
