import type { Category, CategoryListQuery } from '@/types';
import type { CategoryInput, CategoryService } from '../category-service';
import connect from '@/lib/mongodb';
import CategoryModel from '@/lib/models/Category';
import ProductModel from '@/lib/models/Product';

export class MongoCategoryService implements CategoryService {
  async list(query?: CategoryListQuery): Promise<Category[]> {
    await connect();
    const filter: Record<string, unknown> = {};
    if (query?.parentId) filter.parentId = query.parentId;
    const docs = await CategoryModel.find(filter).sort({ name: 1 }).lean();

    const counts = await ProductModel.aggregate([
      { $unwind: { path: '$categoryIds', preserveNullAndEmptyArrays: false } },
      { $group: { _id: '$categoryIds', count: { $sum: 1 } } },
    ]);
    const countMap: Record<string, number> = {};
    for (const c of counts) {
      countMap[c._id] = c.count;
    }

    let result = docs.map((doc) => toCategory(doc, countMap[String(doc._id)] ?? 0));
    if (query?.hideEmpty) result = result.filter((c) => c.productCount > 0);
    return result;
  }

  async getBySlug(slug: string): Promise<Category | null> {
    await connect();
    const doc = await CategoryModel.findOne({ slug }).lean();
    return doc ? await enrichWithCount(doc) : null;
  }

  async create(input: CategoryInput): Promise<Category> {
    await connect();
    const slug = input.slug ?? input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const doc = await CategoryModel.create({
      name: input.name,
      slug,
      parentId: input.parentId ?? null,
      description: input.description ?? '',
    });
    return toCategory(doc.toObject(), 0);
  }

  async update(id: string, input: Partial<CategoryInput>): Promise<Category> {
    await connect();
    const update: Record<string, unknown> = {};
    if (input.name !== undefined) update.name = input.name;
    if (input.slug !== undefined) update.slug = input.slug;
    if (input.parentId !== undefined) update.parentId = input.parentId;
    if (input.description !== undefined) update.description = input.description;
    const doc = await CategoryModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!doc) throw new Error('Category not found');
    return enrichWithCount(doc);
  }

  async remove(id: string): Promise<void> {
    await connect();
    await CategoryModel.findByIdAndDelete(id);
  }
}

function toCategory(doc: Record<string, unknown>, productCount: number): Category {
  return {
    id: String(doc._id),
    parentId: (doc.parentId as string | null) ?? null,
    name: doc.name as string,
    slug: doc.slug as string,
    description: doc.description as string | undefined,
    imageUrl: doc.imageUrl as string | undefined,
    productCount,
  };
}

async function enrichWithCount(doc: Record<string, unknown>): Promise<Category> {
  const id = String(doc._id);
  const count = await ProductModel.countDocuments({ categoryIds: id });
  return toCategory(doc, count);
}
