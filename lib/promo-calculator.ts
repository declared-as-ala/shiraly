import type { PromoCodeData, PromoValidationResult, CartItem } from '@/types';

type CartContext = {
  items: CartItem[];
  subtotal: number;
  cartProductCategoryIds?: Record<string, string[]>;
};

function isExpired(promo: PromoCodeData): boolean {
  if (!promo.expiresAt) return false;
  return new Date(promo.expiresAt) < new Date();
}

function isNotYetActive(promo: PromoCodeData): boolean {
  if (!promo.startsAt) return false;
  return new Date(promo.startsAt) > new Date();
}

function hasReachedUsageLimit(promo: PromoCodeData): boolean {
  if (!promo.usageLimit) return false;
  return promo.usageCount >= promo.usageLimit;
}

function meetsMinimumOrder(promo: PromoCodeData, subtotal: number): boolean {
  if (!promo.minimumOrderAmount) return true;
  return subtotal >= promo.minimumOrderAmount;
}

function isApplicableToCart(promo: PromoCodeData, cart: CartContext): boolean {
  if (promo.applicableTo === 'ALL_PRODUCTS') return true;
  if (promo.applicableTo === 'SPECIFIC_PRODUCTS') {
    return cart.items.some((item) => promo.selectedProductIds.includes(item.productId));
  }
  if (promo.applicableTo === 'SPECIFIC_CATEGORIES' && cart.cartProductCategoryIds) {
    return cart.items.some((item) => {
      const cats = cart.cartProductCategoryIds![item.productId];
      return cats && cats.some((c) => promo.selectedCategoryIds.includes(c));
    });
  }
  return true;
}

export function calculateDiscountAmount(promo: PromoCodeData, subtotal: number): number {
  if (promo.type === 'FIXED_AMOUNT') {
    const discount = Math.min(promo.value, subtotal);
    return Math.max(0, discount);
  }
  const raw = subtotal * (promo.value / 100);
  const capped = promo.maximumDiscountAmount ? Math.min(raw, promo.maximumDiscountAmount) : raw;
  return Math.max(0, Math.min(capped, subtotal));
}

export function validatePromoCode(
  promo: PromoCodeData,
  cart: CartContext,
): PromoValidationResult {
  if (!promo.active) {
    return { valid: false, code: promo.code, error: 'Ce code promo est inactif.' };
  }
  if (isExpired(promo)) {
    return { valid: false, code: promo.code, error: 'Ce code promo a expiré.' };
  }
  if (isNotYetActive(promo)) {
    return { valid: false, code: promo.code, error: "Ce code promo n'est pas encore actif." };
  }
  if (hasReachedUsageLimit(promo)) {
    return { valid: false, code: promo.code, error: 'Ce code promo a atteint sa limite d\'utilisation.' };
  }
  if (!meetsMinimumOrder(promo, cart.subtotal)) {
    return { valid: false, code: promo.code, error: 'Le montant minimum de commande n\'est pas atteint.' };
  }
  if (!isApplicableToCart(promo, cart)) {
    return { valid: false, code: promo.code, error: 'Ce code ne s\'applique pas aux articles de votre panier.' };
  }
  const discountAmount = calculateDiscountAmount(promo, cart.subtotal);
  if (discountAmount <= 0) {
    return { valid: false, code: promo.code, error: 'Ce code promo ne peut pas être appliqué.' };
  }
  return {
    valid: true,
    code: promo.code,
    type: promo.type,
    value: promo.value,
    discountAmount,
    description: promo.description || undefined,
  };
}
