import type { PromoCodeData, PromoCodeCreateInput, PromoCodeUpdateInput, PromoListQuery, PromoListResult, PromoValidationResult, CartItem } from '@/types';
import type { PromoService } from '../promo-service';
import connect from '@/lib/mongodb';
import PromoCodeModel from '@/lib/models/PromoCode';
import ProductModel from '@/lib/models/Product';
import OrderModel from '@/lib/models/Order';
import { validatePromoCode, calculateDiscountAmount } from '@/lib/promo-calculator';

function toData(doc: Record<string, unknown>): PromoCodeData {
  return {
    id: String(doc._id),
    code: doc.code as string,
    description: doc.description as string | undefined,
    type: doc.type as 'PERCENTAGE' | 'FIXED_AMOUNT',
    value: doc.value as number,
    minimumOrderAmount: doc.minimumOrderAmount as number | undefined,
    maximumDiscountAmount: doc.maximumDiscountAmount as number | undefined,
    startsAt: doc.startsAt ? new Date(doc.startsAt as Date).toISOString() : undefined,
    expiresAt: doc.expiresAt ? new Date(doc.expiresAt as Date).toISOString() : undefined,
    usageLimit: doc.usageLimit as number | undefined,
    usageCount: (doc.usageCount as number) ?? 0,
    perUserLimit: doc.perUserLimit as number | undefined,
    active: doc.active as boolean,
    applicableTo: (doc.applicableTo as 'ALL_PRODUCTS' | 'SPECIFIC_PRODUCTS' | 'SPECIFIC_CATEGORIES') ?? 'ALL_PRODUCTS',
    selectedProductIds: (doc.selectedProductIds as string[]) ?? [],
    selectedCategoryIds: (doc.selectedCategoryIds as string[]) ?? [],
    createdAt: (doc.createdAt as string) ?? new Date().toISOString(),
    updatedAt: (doc.updatedAt as string) ?? new Date().toISOString(),
  };
}

export class MongoPromoService implements PromoService {
  async create(input: PromoCodeCreateInput): Promise<PromoCodeData> {
    await connect();
    const doc = await PromoCodeModel.create({
      code: input.code.toUpperCase().trim(),
      description: input.description ?? '',
      type: input.type,
      value: input.value,
      minimumOrderAmount: input.minimumOrderAmount ?? null,
      maximumDiscountAmount: input.maximumDiscountAmount ?? null,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      usageLimit: input.usageLimit ?? null,
      perUserLimit: input.perUserLimit ?? null,
      active: input.active ?? true,
      applicableTo: input.applicableTo ?? 'ALL_PRODUCTS',
      selectedProductIds: input.selectedProductIds ?? [],
      selectedCategoryIds: input.selectedCategoryIds ?? [],
    });
    return toData(doc.toObject());
  }

  async getById(id: string): Promise<PromoCodeData | null> {
    await connect();
    const doc = await PromoCodeModel.findById(id).lean();
    return doc ? toData(doc) : null;
  }

  async getByCode(code: string): Promise<PromoCodeData | null> {
    await connect();
    const doc = await PromoCodeModel.findOne({ code: code.toUpperCase().trim() }).lean();
    return doc ? toData(doc) : null;
  }

  async list(query?: PromoListQuery): Promise<PromoListResult> {
    await connect();
    const filter: Record<string, unknown> = {};
    if (query?.search) {
      const q = query.search;
      filter.$or = [
        { code: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ] as unknown;
    }
    if (query?.active !== undefined) filter.active = query.active;
    if (query?.type) filter.type = query.type;
    if (query?.expired === true) {
      filter.expiresAt = { $lt: new Date() } as unknown;
    } else if (query?.expired === false) {
      filter.$or = [
        { expiresAt: { $gte: new Date() } as unknown },
        { expiresAt: null },
      ];
    }
    const page = query?.page ?? 1;
    const perPage = query?.perPage ?? 20;
    const total = await PromoCodeModel.countDocuments(filter);
    const sortField = query?.sort ?? 'createdAt';
    const sortOrder = query?.order === 'asc' ? 1 : -1;
    const docs = await PromoCodeModel.find(filter)
      .sort({ [sortField]: sortOrder })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .lean();
    return {
      items: docs.map(toData),
      total,
      totalPages: Math.ceil(total / perPage),
      page,
    };
  }

  async update(id: string, patch: PromoCodeUpdateInput): Promise<PromoCodeData> {
    await connect();
    const update: Record<string, unknown> = {};
    if (patch.code !== undefined) update.code = patch.code.toUpperCase().trim();
    if (patch.description !== undefined) update.description = patch.description;
    if (patch.type !== undefined) update.type = patch.type;
    if (patch.value !== undefined) update.value = patch.value;
    if (patch.minimumOrderAmount !== undefined) update.minimumOrderAmount = patch.minimumOrderAmount ?? null;
    if (patch.maximumDiscountAmount !== undefined) update.maximumDiscountAmount = patch.maximumDiscountAmount ?? null;
    if (patch.startsAt !== undefined) update.startsAt = patch.startsAt ? new Date(patch.startsAt) : null;
    if (patch.expiresAt !== undefined) update.expiresAt = patch.expiresAt ? new Date(patch.expiresAt) : null;
    if (patch.usageLimit !== undefined) update.usageLimit = patch.usageLimit ?? null;
    if (patch.perUserLimit !== undefined) update.perUserLimit = patch.perUserLimit ?? null;
    if (patch.active !== undefined) update.active = patch.active;
    if (patch.applicableTo !== undefined) update.applicableTo = patch.applicableTo;
    if (patch.selectedProductIds !== undefined) update.selectedProductIds = patch.selectedProductIds;
    if (patch.selectedCategoryIds !== undefined) update.selectedCategoryIds = patch.selectedCategoryIds;
    const doc = await PromoCodeModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!doc) throw new Error('Promo code not found');
    return toData(doc);
  }

  async remove(id: string): Promise<void> {
    await connect();
    await PromoCodeModel.findByIdAndDelete(id);
  }

  async toggleActive(id: string): Promise<PromoCodeData> {
    await connect();
    const promo = await PromoCodeModel.findById(id).lean();
    if (!promo) throw new Error('Promo code not found');
    const doc = await PromoCodeModel.findByIdAndUpdate(
      id,
      { $set: { active: !promo.active } },
      { new: true },
    ).lean();
    if (!doc) throw new Error('Promo code not found');
    return toData(doc);
  }

  async validateAndApply(
    code: string,
    cart: { items: CartItem[]; subtotal: number },
  ): Promise<PromoValidationResult> {
    await connect();
    const promo = await this.getByCode(code);
    if (!promo) {
      return { valid: false, code: code.toUpperCase().trim(), error: 'Ce code promo est invalide.' };
    }

    let cartProductCategoryIds: Record<string, string[]> | undefined;

    if (promo.applicableTo === 'SPECIFIC_CATEGORIES') {
      cartProductCategoryIds = {};
      const productIds = [...new Set(cart.items.map((i) => i.productId))];
      const products = await ProductModel.find({ _id: { $in: productIds } }).select('categoryIds').lean();
      for (const p of products) {
        const pDoc = p as Record<string, unknown>;
        cartProductCategoryIds[String(pDoc._id)] = (pDoc.categoryIds as string[]) ?? [];
      }
    }

    return validatePromoCode(promo, { ...cart, cartProductCategoryIds });
  }

  async incrementUsage(id: string): Promise<void> {
    await connect();
    await PromoCodeModel.findByIdAndUpdate(id, { $inc: { usageCount: 1 } });
  }

  async getTotalDiscount(id: string): Promise<number> {
    await connect();
    const promo = await PromoCodeModel.findById(id).lean();
    if (!promo) return 0;
    const result = await OrderModel.aggregate([
      { $match: { promoCode: promo.code, status: { $nin: ['cancelled', 'trash', 'checkout-draft'] } } },
      { $group: { _id: null, total: { $sum: '$discountAmount' } } },
    ]);
    return result.length > 0 ? result[0].total : 0;
  }

  async findOrdersByPromo(code: string): Promise<{ id: string; number: string; total: number; discountAmount: number; createdAt: string }[]> {
    await connect();
    const docs = await OrderModel.find({ promoCode: code.toUpperCase().trim() })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return docs.map((d) => ({
      id: String(d._id),
      number: d.number as string,
      total: d.total as number,
      discountAmount: (d.discountAmount as number) ?? 0,
      createdAt: (d.createdAt as string) ?? new Date().toISOString(),
    }));
  }
}
