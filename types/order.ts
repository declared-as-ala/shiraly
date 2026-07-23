import type { CartItem } from './cart';

export type CheckoutCustomer = {
  firstName: string;
  lastName?: string;
  phone: string;
  phone2?: string;
  email?: string;
  city: string;
  address: string;
  note?: string;
};

export type CheckoutPayload = {
  customer: CheckoutCustomer;
  items: CartItem[];
  shipping: number;     // delivery cost
  subtotal?: number;
  total?: number;
  deliveryCompany?: string;
  paymentMethod?: 'cod' | 'card';
  source?: string;      // utm/source for analytics
  status?: string;      // optional status
  attempts?: number;    // number of call attempts
  promoCode?: string;
  discountAmount?: number;
};

// Standard WooCommerce statuses + any custom slug (e.g. Tunisian COD plugins:
// "en-attente", "confirme", "annule", "tentative", "auto-draft", "checkout-draft", etc.)
export type StandardOrderStatus =
  | 'pending'
  | 'processing'
  | 'on-hold'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'failed';
export type OrderStatus = StandardOrderStatus | (string & {});

export type OrderLineItem = {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  imageUrl?: string;
  attributes?: { key: string; value: string }[];   // variation / bundle slot info shown in admin
};

export type OrderDelivery = {
  provider: string | null;
  trackingNumber: string | null;
  statusCode: string | null;
  statusMessage: string | null;
  labelUrl: string | null;
  failed: boolean;
  error: string | null;
  payload: Record<string, unknown> | null;
  lastSyncAt: string | null;
};

export type OrderResponse = {
  id: string;
  number: string;
  status: OrderStatus;
  currency: string;
  total: number;
  createdAt: string;       // ISO
  customer: CheckoutCustomer;
  items: OrderLineItem[];
  shipping: number;
  deliveryCompany?: string;
  assignedEmployeeId?: string | null;
  assignedAt?: string | null;
  delivery?: OrderDelivery;
  promoCode?: string | null;
  discountAmount?: number;
  finalTotal?: number | null;
  meta?: Record<string, unknown>;
};
