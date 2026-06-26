import type { CheckoutPayload, OrderResponse, OrderStatus } from '@/types';
import type { OrderService, OrderListQuery, OrderListResult, OrderUpdate } from '../order-service';
import connect from '@/lib/mongodb';
import OrderModel from '@/lib/models/Order';
import EmployeeModel from '@/lib/models/Employee';
import { pickNextInRoundRobin } from '@/lib/round-robin';

function toOrder(doc: Record<string, unknown>): OrderResponse {
  const d = doc as Record<string, unknown>;
  const customer = d.customer as Record<string, unknown>;
  const items = (d.items as Array<Record<string, unknown>>) ?? [];
  return {
    id: String(d._id),
    number: d.number as string,
    status: (d.status as OrderStatus) ?? 'pending',
    currency: (d.currency as string) ?? 'TND',
    total: d.total as number,
    createdAt: (d.createdAt as string) ?? (d.createdAt as string) ?? new Date().toISOString(),
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
    assignedEmployeeId: d.assignedEmployeeId as string | null | undefined,
    assignedAt: d.assignedAt as string | null | undefined,
    meta: (d.meta as Record<string, unknown>) ?? {},
  };
}

let orderCounter = Date.now();

function generateNumber(): string {
  return `SH-${++orderCounter}`;
}

export class MongoOrderService implements OrderService {
  async create(payload: CheckoutPayload): Promise<OrderResponse> {
    await connect();

    const activeEmps = await EmployeeModel.find({ active: true }).select('_id').lean();
    const activeIds = activeEmps.map((e) => String(e._id));
    let assignedId: string | null = null;
    let assignedAt: string | null = null;

    if (activeIds.length > 0) {
      assignedId = await pickNextInRoundRobin(activeIds);
      assignedAt = assignedId ? new Date().toISOString() : null;
    }

    const doc = await OrderModel.create({
      number: generateNumber(),
      status: payload.status ?? 'pending',
      currency: 'TND',
      total: payload.total ?? 0,
      subtotal: payload.subtotal ?? 0,
      shipping: payload.shipping ?? 0,
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
        attributes: i.bundleSlot ? [{ key: 'Bundle', value: String(i.bundleSlot) }] : undefined,
      })),
      deliveryCompany: payload.deliveryCompany ?? '',
      paymentMethod: payload.paymentMethod ?? 'cod',
      source: payload.source ?? '',
      attempts: payload.attempts ?? 0,
      assignedEmployeeId: assignedId,
      assignedAt,
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
    if (query?.status && query.status !== 'any') filter.status = query.status;
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
