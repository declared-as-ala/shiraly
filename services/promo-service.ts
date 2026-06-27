import type { PromoCodeData, PromoCodeCreateInput, PromoCodeUpdateInput, PromoListQuery, PromoListResult, PromoValidationResult, CartItem } from '@/types';

export interface PromoService {
  create(input: PromoCodeCreateInput): Promise<PromoCodeData>;
  getById(id: string): Promise<PromoCodeData | null>;
  getByCode(code: string): Promise<PromoCodeData | null>;
  list(query?: PromoListQuery): Promise<PromoListResult>;
  update(id: string, patch: PromoCodeUpdateInput): Promise<PromoCodeData>;
  remove(id: string): Promise<void>;
  toggleActive(id: string): Promise<PromoCodeData>;
  validateAndApply(code: string, cart: { items: CartItem[]; subtotal: number }): Promise<PromoValidationResult>;
  incrementUsage(id: string): Promise<void>;
  getTotalDiscount(id: string): Promise<number>;
  findOrdersByPromo(code: string): Promise<{ id: string; number: string; total: number; discountAmount: number; createdAt: string }[]>;
}
