import { Schema, model, models } from 'mongoose';

const CategorySchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  parentId: { type: String, default: null },
  description: { type: String, default: '' },
  imageUrl: { type: String, default: null },
}, { timestamps: true });

CategorySchema.virtual('productCount').get(function () {
  return 0;
});

CategorySchema.set('toJSON', { virtuals: true });
CategorySchema.set('toObject', { virtuals: true });

const CategoryModel = models.Category || model('Category', CategorySchema);

export default CategoryModel;
export { CategorySchema };
