import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { orderService } from '@/services';
import { navex, navexConfigured, buildNavexDesignation } from '@/lib/navex';
import { alreadySentResponse, withDeliveryLock } from '@/lib/delivery-idempotency';

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!navexConfigured) return NextResponse.json({ error: 'Navex non configuré (env)' }, { status: 400 });

  const { orderId } = await req.json();
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

  return withDeliveryLock(`navex:${orderId}`, async () => {
    const order = await orderService.getById(String(orderId));
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const existingTracking = String((order.meta?._navex_tracking as string) ?? '').trim();
    if (existingTracking || order.meta?._navex_status === 'sent') {
      return NextResponse.json(alreadySentResponse(existingTracking), { status: 200 });
    }

    const codAmount = order.total;
    const { designation: productLabel, nbArticle: itemsCount } = buildNavexDesignation(order.items);

    const result = await navex.createShipment({
      reference: `#${order.number || order.id}`,
      receiverName: order.customer.firstName + (order.customer.lastName ? ' ' + order.customer.lastName : ''),
      receiverPhone: order.customer.phone,
      receiverGov: order.customer.city,
      receiverCity: order.customer.city,
      receiverAddress: order.customer.address,
      codAmount,
      itemsCount,
      productLabel,
    });

    const meta: Record<string, unknown> = { ...order.meta };
    meta._navex_status = result.ok ? 'sent' : 'failed';
    meta._navex_response = typeof result.raw === 'string' ? result.raw : JSON.stringify(result.raw ?? null);
    if (result.barcode) meta._navex_tracking = result.barcode;
    if (result.error) meta._navex_error = result.error;
    try { await orderService.update(order.id, { meta }); } catch {}

    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  });
}
