import type { CheckoutPayload, OrderResponse, OrderStatus } from '@/types';
import type { OrderService, OrderListQuery, OrderListResult, OrderUpdate } from '../order-service';
import connect from '@/lib/mongodb';
import OrderModel from '@/lib/models/Order';
import ProductModel from '@/lib/models/Product';

function toOrder(doc: Record<string, unknown>): OrderResponse {
  const d = doc as Record<string, unknown>;
  const customer = d.customer as Record<string, unknown>;
  const items = (d.items as Array<Record<string, unknown>>) ?? [];
  const shippingVal = Number(d.shipping) || 0;
  const itemsTotal = items.reduce((s, i) => s + (Number(i.total) || 0), 0);
  const storedTotal = Number(d.total) || 0;
  const total = storedTotal > 0 ? storedTotal : itemsTotal + shippingVal;
  return {
    id: String(d._id),
    number: d.number as string,
    status: (d.status as OrderStatus) ?? 'pending',
    currency: (d.currency as string) ?? 'TND',
    total,
    createdAt: (d.createdAt as string) ?? new Date().toISOString(),
    customer: {
      firstName: customer.firstName as string,
      lastName: customer.lastName as string | undefined,
      phone: customer.phone as string,
      phone2: customer.phone2 as string | undefined,
      email: customer.email as string | undefined,
      city: customer.city as string,
      address: customer.address as string,
      note: customer.note as string | undefined,
    },
    items: items.map((i) => ({
      productId: i.productId as string,
      name: i.name as string,
      quantity: i.quantity as number,
      price: i.price as number,
      total: i.total as number,
      imageUrl: i.imageUrl as string | undefined,
      attributes: i.attributes as Array<{ key: string; value: string }> | undefined,
    })),
    shipping: d.shipping as number,
    deliveryCompany: (d.deliveryCompany as string | undefined) ?? '',
    assignedEmployeeId: d.assignedEmployeeId as string | null | undefined,
    assignedAt: d.assignedAt as string | null | undefined,
    delivery: toDelivery(d.delivery as Record<string, unknown> | undefined),
    promoCode: d.promoCode as string | null | undefined,
    discountAmount: (d.discountAmount as number) ?? 0,
    finalTotal: d.finalTotal as number | null | undefined,
    meta: (d.meta as Record<string, unknown>) ?? {},
  };
}

function toDelivery(d?: Record<string, unknown>): OrderResponse['delivery'] {
  return {
    provider: (d?.provider as string | null) ?? null,
    trackingNumber: (d?.trackingNumber as string | null) ?? null,
    statusCode: (d?.statusCode as string | null) ?? null,
    statusMessage: (d?.statusMessage as string | null) ?? null,
    labelUrl: (d?.labelUrl as string | null) ?? null,
    failed: Boolean(d?.failed),
    error: (d?.error as string | null) ?? null,
    payload: (d?.payload as Record<string, unknown> | null) ?? null,
    lastSyncAt: (d?.lastSyncAt as string | null) ?? null,
  };
}

/**
 * Build order-line attributes from a cart item's selected variation (size/color)
 * + bundle info, in the shape the admin drawer's parseLine expects:
 *  - simple line  → [{ key: 'Size', value: 'M' }, …]
 *  - bundle slot  → [{ key: 'Offre', value: '…' }, { key: 'Item 1', value: 'Size: M · Couleur: noir' }]
 */
function lineAttributes(i: {
  variation?: Record<string, string>;
  bundleSlot?: number;
  bundleName?: string;
}): { key: string; value: string }[] | undefined {
  const variation = i.variation ?? {};
  const entries = Object.entries(variation).filter(([, v]) => v);
  const attrs: { key: string; value: string }[] = [];

  if (i.bundleSlot) {
    if (i.bundleName) attrs.push({ key: 'Offre', value: String(i.bundleName) });
    attrs.push({ key: `Item ${i.bundleSlot}`, value: entries.map(([k, v]) => `${k}: ${v}`).join(' · ') || '—' });
  } else {
    for (const [k, v] of entries) attrs.push({ key: String(k), value: String(v) });
    if (i.bundleName) attrs.push({ key: 'Offre', value: String(i.bundleName) });
  }
  return attrs.length ? attrs : undefined;
}

let orderCounter = Date.now();

function generateNumber(): string {
  return `SH-${++orderCounter}`;
}

export class MongoOrderService implements OrderService {
  async create(payload: CheckoutPayload, promoCode?: string | null, discountAmount?: number): Promise<OrderResponse> {
    await connect();

    const discount = discountAmount ?? 0;
    const finalTotal = Math.max(0, (payload.total ?? 0));

    const doc = await OrderModel.create({
      number: generateNumber(),
      status: payload.status ?? 'pending',
      currency: 'TND',
      total: payload.total ?? 0,
      subtotal: payload.subtotal ?? 0,
      shipping: payload.shipping ?? 0,
      promoCode: promoCode ?? null,
      discountAmount: discount,
      finalTotal: finalTotal > 0 ? finalTotal : null,
      customer: {
        firstName: payload.customer.firstName,
        lastName: payload.customer.lastName ?? '',
        phone: payload.customer.phone,
        phone2: payload.customer.phone2 ?? '',
        email: payload.customer.email ?? '',
        city: payload.customer.city,
        address: payload.customer.address,
        note: payload.customer.note ?? '',
      },
      items: payload.items.map((i) => ({
        productId: i.productId,
        name: i.name,
        quantity: i.qty,
        price: i.price,
        total: i.price * i.qty,
        imageUrl: i.image,
        attributes: lineAttributes(i),
      })),
      deliveryCompany: payload.deliveryCompany ?? '',
      paymentMethod: payload.paymentMethod ?? 'cod',
      source: payload.source ?? '',
      attempts: payload.attempts ?? 0,
      assignedEmployeeId: null,
      assignedAt: null,
    });

    return toOrder(doc.toObject());
  }

  async getById(id: string): Promise<OrderResponse | null> {
    await connect();
    const doc = await OrderModel.findById(id).lean();
    return doc ? toOrder(doc) : null;
  }

  async list(query?: OrderListQuery): Promise<OrderListResult> {
    await connect();
    const filter: Record<string, unknown> = {};
    if (query?.status && query.status !== 'any') {
      const statuses = String(query.status).split(',').map((s) => s.trim()).filter(Boolean);
      filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
    }
    if (query?.search) {
      filter.$or = [
        { number: { $regex: query.search, $options: 'i' } },
        { 'customer.name': { $regex: query.search, $options: 'i' } },
        { 'customer.phone': { $regex: query.search, $options: 'i' } },
      ] as unknown;
    }
    if (query?.assignedEmployeeId === 'unassigned') filter.assignedEmployeeId = null;
    else if (query?.assignedEmployeeId && query.assignedEmployeeId !== 'any') filter.assignedEmployeeId = query.assignedEmployeeId;
    if (query?.after) filter.createdAt = { $gte: new Date(query.after) } as unknown;
    if (query?.before) filter.createdAt = { ...(filter.createdAt as Record<string, unknown>), $lte: new Date(query.before) } as unknown;
    const page = query?.page ?? 1;
    const perPage = query?.perPage ?? 20;
    const total = await OrderModel.countDocuments(filter);
    const docs = await OrderModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * perPage).limit(perPage).lean();
    return { items: docs.map(toOrder), total, totalPages: Math.ceil(total / perPage), page };
  }

  async update(id: string, patch: OrderUpdate): Promise<OrderResponse> {
    await connect();
    const update: Record<string, unknown> = {};
    if (patch.status) update.status = patch.status;
    if (patch.shipping !== undefined) update.shipping = patch.shipping;
    if (patch.deliveryCompany !== undefined) update.deliveryCompany = patch.deliveryCompany;
    if (patch.exchange !== undefined) update.exchange = patch.exchange;
    if (patch.privateNote !== undefined) update.privateNote = patch.privateNote;
    if (patch.subtotal !== undefined) update.subtotal = patch.subtotal;
    if (patch.total !== undefined) update.total = patch.total;
    if (patch.attempts !== undefined) update.attempts = patch.attempts;
    if (patch.promoCode !== undefined) update.promoCode = patch.promoCode;
    if (patch.discountAmount !== undefined) update.discountAmount = patch.discountAmount;
    if (patch.finalTotal !== undefined) update.finalTotal = patch.finalTotal;
    if (patch.items !== undefined) {
      // The storefront finalize/draft-save sends items without name/image; never
      // blank them out — reuse the existing order item, then fall back to the product.
      const existing = await OrderModel.findById(id).lean();
      const existingItems = (existing?.items as Array<Record<string, unknown>>) ?? [];
      const missingIds = [...new Set(patch.items.filter((it) => !it.name || !it.image).map((it) => String(it.productId)))];
      const prods = missingIds.length ? await ProductModel.find({ _id: { $in: missingIds } }).lean() : [];
      const prodMap = new Map(prods.map((p) => [String(p._id), p as Record<string, unknown>]));

      update.items = patch.items.map((item) => {
        const quantity = Number(item.qty) || 0;
        const price = Number(item.unitPrice ?? item.price) || 0;
        const prev = existingItems.find((e) => String(e.productId) === String(item.productId));
        const prod = prodMap.get(String(item.productId));
        const prodImg = ((prod?.images as Array<{ url?: string }> | undefined) ?? [])[0]?.url;
        return {
          productId: item.productId,
          name: item.name || (prev?.name as string) || (prod?.name as string) || '',
          quantity,
          price,
          total: price * quantity,
          imageUrl: item.image || (prev?.imageUrl as string) || prodImg || undefined,
          attributes: lineAttributes(item),
        };
      });
    }
    if (patch.delivery !== undefined) {
      for (const [k, v] of Object.entries(patch.delivery)) {
        update[`delivery.${k}`] = v;
      }
    }
    if (patch.meta !== undefined) update.meta = patch.meta;
    if (patch.customer) {
      update['customer.firstName'] = patch.customer.firstName;
      update['customer.phone'] = patch.customer.phone;
      update['customer.city'] = patch.customer.city;
      update['customer.address'] = patch.customer.address;
    }
    const doc = await OrderModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!doc) throw new Error('Order not found');
    return toOrder(doc);
  }

  async remove(id: string): Promise<void> {
    await connect();
    await OrderModel.findByIdAndDelete(id);
  }

  async assignEmployee(orderId: string, employeeId: string | null, assignedBy?: 'auto' | 'admin'): Promise<OrderResponse> {
    await connect();
    const update: Record<string, unknown> = {
      assignedEmployeeId: employeeId,
      assignedAt: employeeId ? new Date().toISOString() : null,
      assignedBy: assignedBy ?? 'admin',
    };
    const doc = await OrderModel.findByIdAndUpdate(orderId, { $set: update }, { new: true }).lean();
    if (!doc) throw new Error('Order not found');
    return toOrder(doc);
  }
}
