import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { orderService } from '@/services';
import { firstDelivery, firstDeliveryConfigured, buildFirstDeliveryDesignation } from '@/lib/firstdelivery';
import { alreadySentResponse, withDeliveryLock } from '@/lib/delivery-idempotency';

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!firstDeliveryConfigured) return NextResponse.json({ error: 'First Delivery non configuré (env)' }, { status: 400 });

  const { orderId } = await req.json();
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

  return withDeliveryLock(`firstdelivery:${orderId}`, async () => {
    const order = await orderService.getById(String(orderId));
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const existingTracking = String((order.meta?._fd_tracking as string) ?? '').trim();
    if (existingTracking || order.meta?._fd_status === 'sent') {
      return NextResponse.json(alreadySentResponse(existingTracking), { status: 200 });
    }

    const codAmount = order.total;
    const { designation: productLabel, nbArticle: itemsCount } = buildFirstDeliveryDesignation(order.items);

    const result = await firstDelivery.createShipment({
      receiverName: order.customer.firstName + (order.customer.lastName ? ' ' + order.customer.lastName : ''),
      receiverPhone: order.customer.phone,
      receiverPhone2: String((order.meta?._mzem_phone_2 as string) ?? ''),
      receiverGov: order.customer.city,
      receiverCity: order.customer.city,
      receiverAddress: order.customer.address,
      codAmount,
      itemsCount,
      productLabel,
      note: String((order.meta?._mzem_private_note as string) ?? ''),
    });

    const meta: Record<string, unknown> = { ...order.meta };
    meta._fd_status = result.ok ? 'sent' : 'failed';
    meta._fd_response = typeof result.raw === 'string' ? result.raw : JSON.stringify(result.raw ?? null);
    if (result.barcode) meta._fd_tracking = result.barcode;
    if (result.error) meta._fd_error = result.error;
    try { await orderService.update(order.id, { meta }); } catch {}

    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  });
}
