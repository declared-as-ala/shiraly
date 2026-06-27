import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { orderService } from '@/services';
import { trackShipment } from '@/lib/best-delivery';

/**
 * GET /api/admin/best-delivery/track?orderId=...   (or ?tracking=...)
 * Returns the full shipment status history.
 */
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    let tracking = searchParams.get('tracking') ?? '';
    const orderId = searchParams.get('orderId');

    if (!tracking && orderId) {
      const order = await orderService.getById(orderId);
      tracking = order?.delivery?.trackingNumber ?? '';
    }
    if (!tracking) return NextResponse.json({ error: 'Numéro de suivi manquant' }, { status: 400 });

    const result = await trackShipment(tracking);
    if (result.hasErrors) {
      return NextResponse.json({ ok: false, error: result.errorsTxt ?? 'Erreur de suivi', events: [] }, { status: 422 });
    }
    return NextResponse.json({ ok: true, events: result.events });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Échec Best Delivery';
    console.error('[best-delivery] track failed:', msg);
    return NextResponse.json({ ok: false, error: msg, events: [] }, { status: 502 });
  }
}
