import type { Product, ProductListQuery, ProductListResult } from '@/types';
import type { ProductInput, ProductService } from '../product-service';
import connect from '@/lib/mongodb';
import ProductModel from '@/lib/models/Product';

function toProduct(doc: Record<string, unknown>): Product {
  const d = doc as Record<string, unknown>;
  const images = (d.images as Array<{ url: string; alt?: string }> | undefined) ?? [];
  // `price`/`onSale` are schema virtuals — `.lean()` queries strip them, so compute here.
  const regularPrice = Number(d.regularPrice) || 0;
  const rawSale = d.salePrice;
  const salePrice = rawSale === null || rawSale === undefined ? null : Number(rawSale);
  const onSale = salePrice != null && salePrice < regularPrice;
  const price = onSale ? (salePrice as number) : regularPrice;
  return {
    id: String(d._id),
    slug: d.slug as string,
    name: d.name as string,
    status: (d.status as Product['status']) ?? 'published',
    description: (d.description as string) ?? '',
    shortDescription: (d.shortDescription as string) ?? '',
    price,
    regularPrice,
    salePrice,
    onSale,
    currency: (d.currency as string) ?? 'TND',
    inStock: (d.inStock as boolean) ?? true,
    stockQuantity: (d.stockQuantity as number | null) ?? null,
    images: images.map((img) => ({
      id: img.url,
      url: img.url,
      alt: img.alt ?? '',
    })),
    hoverImage: (d.hoverImage as string | null) ?? null,
    categoryIds: (d.categoryIds as string[]) ?? [],
    categorySlugs: (d.categorySlugs as string[]) ?? [],
    attributes: (d.attributes as Product['attributes']) ?? [],
    bundles: (d.bundles as Product['bundles']) ?? [],
    upsellIds: (d.upsellIds as string[]) ?? [],
    crossSellIds: (d.crossSellIds as string[]) ?? [],
    metaTitle: (d.metaTitle as string | null) ?? null,
    metaDescription: (d.metaDescription as string | null) ?? null,
    focusKeyword: (d.focusKeyword as string | null) ?? null,
    meta: (d.meta as Record<string, unknown>) ?? {},
  };
}

/** imageIds carry image URLs in this backend (toProduct sets image.id = url). */
function imagesFromIds(imageIds?: string[], alt?: string | null) {
  if (!imageIds) return undefined;
  return imageIds.map((url, i) => ({ url, alt: i === 0 && alt ? alt : undefined }));
}

export class MongoProductService implements ProductService {
  async list(query: ProductListQuery = {}): Promise<ProductListResult> {
    await connect();
    const filter: Record<string, unknown> = {};
    if (query.status && query.status !== 'any') filter.status = query.status === 'published' ? 'published' : query.status;
    if (query.search) filter.name = { $regex: query.search, $options: 'i' } as unknown;
    if (query.categorySlug) filter.categorySlugs = query.categorySlug;
    if (query.categoryId) filter.categoryIds = query.categoryId;
    if (query.onSale) filter.salePrice = { $ne: null, $lt: { $toDouble: '$regularPrice' } } as unknown;
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 24;
    const total = await ProductModel.countDocuments(filter);
    const sort: Record<string, 1 | -1> = {};
    if (query.orderBy === 'price') sort.regularPrice = query.order === 'asc' ? 1 : -1;
    else if (query.orderBy === 'title') sort.name = query.order === 'asc' ? 1 : -1;
    else if (query.orderBy === 'menu_order') sort.menuOrder = 1;
    else sort.createdAt = -1;
    const docs = await ProductModel.find(filter).sort(sort).skip((page - 1) * perPage).limit(perPage).lean();
    return { items: docs.map(toProduct), total, totalPages: Math.ceil(total / perPage), page };
  }

  async getBySlug(slug: string): Promise<Product | null> {
    await connect();
    const doc = await ProductModel.findOne({ slug }).lean();
    return doc ? toProduct(doc) : null;
  }

  async getById(id: string): Promise<Product | null> {
    await connect();
    const doc = await ProductModel.findById(id).lean();
    return doc ? toProduct(doc) : null;
  }

  async getRelated(productId: string, limit = 4): Promise<Product[]> {
    await connect();
    const product = await ProductModel.findById(productId).lean();
    if (!product) return [];
    if (product.upsellIds?.length) {
      const docs = await ProductModel.find({ _id: { $in: product.upsellIds } }).limit(limit).lean();
      return docs.map(toProduct);
    }
    if (product.categoryIds?.length) {
      const docs = await ProductModel.find({ _id: { $ne: productId }, categoryIds: { $in: product.categoryIds } }).limit(limit).lean();
      return docs.map(toProduct);
    }
    return [];
  }

  async create(input: ProductInput): Promise<Product> {
    await connect();
    const slug = input.slug ?? input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const doc = await ProductModel.create({
      slug,
      name: input.name,
      description: input.description ?? '',
      shortDescription: input.shortDescription ?? '',
      regularPrice: input.regularPrice ?? 0,
      salePrice: input.salePrice ?? null,
      status: input.status ?? 'published',
      stockQuantity: input.stockQuantity ?? null,
      inStock: input.stockQuantity == null ? true : input.stockQuantity > 0,
      categoryIds: input.categoryIds ?? [],
      images: imagesFromIds(input.imageIds, input.imageAlt) ?? [],
      hoverImage: input.hoverImage ?? null,
      bundles: input.bundles ?? [],
      upsellIds: input.upsellIds ?? [],
      attributes: input.options?.map((o) => ({ name: o.label, options: o.values?.split(',').map((s: string) => s.trim()) ?? [], variation: o.type !== 'text' })) ?? [],
      metaTitle: input.metaTitle ?? null,
      metaDescription: input.metaDescription ?? null,
      focusKeyword: input.focusKeyword ?? null,
    });
    return toProduct(doc.toObject());
  }

  async update(id: string, input: Partial<ProductInput>): Promise<Product> {
    await connect();
    const update: Record<string, unknown> = {};
    if (input.name !== undefined) update.name = input.name;
    if (input.slug !== undefined) update.slug = input.slug;
    if (input.description !== undefined) update.description = input.description;
    if (input.shortDescription !== undefined) update.shortDescription = input.shortDescription;
    if (input.regularPrice !== undefined) update.regularPrice = input.regularPrice;
    if (input.salePrice !== undefined) update.salePrice = input.salePrice;
    if (input.status !== undefined) update.status = input.status;
    if (input.categoryIds !== undefined) update.categoryIds = input.categoryIds;
    if (input.bundles !== undefined) update.bundles = input.bundles;
    if (input.upsellIds !== undefined) update.upsellIds = input.upsellIds;
    if (input.options !== undefined) {
      update.attributes = input.options.map((o) => ({ name: o.label, options: o.values?.split(',').map((s: string) => s.trim()) ?? [], variation: o.type !== 'text' }));
    }
    if (input.hoverImage !== undefined) update.hoverImage = input.hoverImage;
    if (input.imageIds !== undefined) update.images = imagesFromIds(input.imageIds, input.imageAlt) ?? [];
    if (input.stockQuantity !== undefined) {
      update.stockQuantity = input.stockQuantity;
      update.inStock = input.stockQuantity == null ? true : input.stockQuantity > 0;
    }
    if (input.metaTitle !== undefined) update.metaTitle = input.metaTitle;
    if (input.metaDescription !== undefined) update.metaDescription = input.metaDescription;
    if (input.focusKeyword !== undefined) update.focusKeyword = input.focusKeyword;
    const doc = await ProductModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!doc) throw new Error('Product not found');
    return toProduct(doc);
  }

  async remove(id: string): Promise<void> {
    await connect();
    await ProductModel.findByIdAndDelete(id);
  }

  async reorder(items: { id: string; menuOrder: number }[]): Promise<void> {
    await connect();
    const ops = items.map((x) => ({
      updateOne: { filter: { _id: x.id }, update: { $set: { menuOrder: x.menuOrder } } },
    }));
    await ProductModel.bulkWrite(ops);
  }
}
