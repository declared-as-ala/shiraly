import { Schema, model, models } from 'mongoose';

const PromoCodeSchema = new Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  description: { type: String, default: '' },
  type: { type: String, enum: ['PERCENTAGE', 'FIXED_AMOUNT'], required: true },
  value: { type: Number, required: true },
  minimumOrderAmount: { type: Number, default: null },
  maximumDiscountAmount: { type: Number, default: null },
  startsAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
  usageLimit: { type: Number, default: null },
  usageCount: { type: Number, default: 0 },
  perUserLimit: { type: Number, default: null },
  active: { type: Boolean, default: true },
  applicableTo: {
    type: String,
    enum: ['ALL_PRODUCTS', 'SPECIFIC_PRODUCTS', 'SPECIFIC_CATEGORIES'],
    default: 'ALL_PRODUCTS',
  },
  selectedProductIds: [{ type: String }],
  selectedCategoryIds: [{ type: String }],
}, { timestamps: true });

PromoCodeSchema.index({ code: 1 });
PromoCodeSchema.index({ active: 1, expiresAt: 1 });

const PromoCodeModel = models.PromoCode || model('PromoCode', PromoCodeSchema);

export default PromoCodeModel;
export { PromoCodeSchema };
