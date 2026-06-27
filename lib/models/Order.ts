import { Schema, model, models } from 'mongoose';

const LineItemSchema = new Schema({
  productId: { type: String, required: true },
  name: String,
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  total: { type: Number, required: true },
  imageUrl: String,
  attributes: [{ key: String, value: String }],
}, { _id: false });

const OrderSchema = new Schema({
  number: { type: String, required: true, unique: true },
  status: { type: String, default: 'pending' },
  currency: { type: String, default: 'TND' },
  total: { type: Number, required: true },
  subtotal: { type: Number, default: 0 },
  shipping: { type: Number, default: 0 },
  customer: {
    firstName: { type: String, required: true },
    lastName: String,
    phone: { type: String, required: true },
    phone2: String,
    email: String,
    city: { type: String, required: true },
    address: { type: String, required: true },
    note: String,
  },
  items: [LineItemSchema],
  assignedEmployeeId: { type: String, default: null },
  assignedAt: { type: String, default: null },
  assignedBy: { type: String, enum: ['auto', 'admin'], default: 'auto' },
  deliveryCompany: String,
  paymentMethod: { type: String, default: 'cod' },
  source: String,
  attempts: { type: Number, default: 0 },
  exchange: { type: Boolean, default: false },
  privateNote: String,
  // ── Delivery provider integration (Best Delivery, etc.) ───────────────────
  delivery: {
    provider: { type: String, default: null },          // e.g. 'best_delivery'
    trackingNumber: { type: String, default: null },     // CodeBarre
    statusCode: { type: String, default: null },
    statusMessage: { type: String, default: null },
    labelUrl: { type: String, default: null },           // printable label Url
    failed: { type: Boolean, default: false },           // creation failed → allow retry
    error: { type: String, default: null },              // ErrorsTxt
    payload: { type: Schema.Types.Mixed, default: null }, // raw provider response
    lastSyncAt: { type: String, default: null },         // ISO
  },
  meta: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

const OrderModel = models.Order || model('Order', OrderSchema);

export default OrderModel;
export { OrderSchema };
