import { Schema, model, models } from 'mongoose';

const ProductImageSchema = new Schema({
  url: { type: String, required: true },
  alt: String,
}, { _id: false });

const ProductAttributeSchema = new Schema({
  name: { type: String, required: true },
  options: [String],
  variation: { type: Boolean, default: false },
}, { _id: false });

const ProductBundleSchema = new Schema({
  name: { type: String, required: true },
  label: String,
  regularPrice: { type: Number, required: true },
  price: { type: Number, required: true },
  deliveryPrice: { type: Number, default: 0 },
  quantity: { type: Number, required: true },
  badgeColor: { type: String, enum: ['red', 'green', 'blue', 'purple'], default: 'red' },
  imageUrl: String,
  isDefault: { type: Boolean, default: false },
}, { _id: false });

const ProductSchema = new Schema({
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  status: { type: String, enum: ['published', 'draft', 'private'], default: 'published' },
  description: { type: String, default: '' },
  shortDescription: { type: String, default: '' },
  regularPrice: { type: Number, required: true },
  salePrice: { type: Number, default: null },
  currency: { type: String, default: 'TND' },
  inStock: { type: Boolean, default: true },
  stockQuantity: { type: Number, default: null },
  images: [ProductImageSchema],
  hoverImage: { type: String, default: null },
  categoryIds: [String],
  categorySlugs: [String],
  attributes: [ProductAttributeSchema],
  bundles: [ProductBundleSchema],
  upsellIds: [String],
  crossSellIds: [String],
  // SEO
  metaTitle: { type: String, default: null },
  metaDescription: { type: String, default: null },
  focusKeyword: { type: String, default: null },
  meta: { type: Schema.Types.Mixed, default: {} },
  menuOrder: { type: Number, default: 0 },
}, { timestamps: true });

ProductSchema.virtual('price').get(function () {
  return this.salePrice ?? this.regularPrice;
});

ProductSchema.virtual('onSale').get(function () {
  return this.salePrice != null && this.salePrice < this.regularPrice;
});

ProductSchema.set('toJSON', { virtuals: true });
ProductSchema.set('toObject', { virtuals: true });

const ProductModel = models.Product || model('Product', ProductSchema);

export default ProductModel;
export { ProductSchema };
