import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { navex } from '@/lib/navex';
import { orderService } from '@/services';

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { orderId } = await req.json().catch(() => ({}));
  if (!orderId) return NextResponse.json({ error: 'orderId requis' }, { status: 400 });

  const order = await orderService.getById(String(orderId));
  if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
  if (order.delivery?.provider !== 'navex' || !order.delivery.trackingNumber) {
    return NextResponse.json({ error: 'Aucun numéro de suivi Navex' }, { status: 400 });
  }

  const result = await navex.getState(order.delivery.trackingNumber);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error ?? 'Erreur de suivi Navex' }, { status: 422 });

  const data = result.raw as Record<string, unknown>;
  const state = String(data.etat ?? '').trim();
  const reason = String(data.motif ?? '').trim();
  const updated = await orderService.update(order.id, {
    delivery: {
      statusCode: state || null,
      statusMessage: [state, reason].filter(Boolean).join(' — ') || 'Statut Navex reçu',
      payload: data,
      failed: false,
      error: null,
      lastSyncAt: new Date().toISOString(),
    },
  });
  return NextResponse.json({ ok: true, delivery: updated.delivery, tracking: data });
}
