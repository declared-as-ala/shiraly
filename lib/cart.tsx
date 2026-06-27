'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, PromoAppliedState } from '@/types';

type AddInput = Omit<CartItem, 'lineId'> & { lineId?: string };

type CartState = {
  items: CartItem[];
  appliedPromo: PromoAppliedState | null;
  add: (item: AddInput) => void;
  setQty: (lineId: string, qty: number) => void;
  remove: (lineId: string) => void;
  clear: () => void;
  applyPromo: (promo: PromoAppliedState) => void;
  removePromo: () => void;
};

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function sameLine(a: CartItem, b: AddInput): boolean {
  if (a.productId !== b.productId) return false;
  if ((a.bundleId ?? '') !== (b.bundleId ?? '')) return false;
  if ((a.bundleSlot ?? null) !== (b.bundleSlot ?? null)) return false;
  return JSON.stringify(a.variation ?? null) === JSON.stringify(b.variation ?? null);
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      appliedPromo: null,
      add: (input) => {
        const items = get().items.slice();
        const i = items.findIndex((x) => sameLine(x, input));
        if (i >= 0 && input.bundleSlot === undefined) {
          items[i] = { ...items[i], qty: items[i].qty + input.qty };
        } else {
          items.push({ ...input, lineId: input.lineId ?? newId() });
        }
        set({ items, appliedPromo: null });
      },
      setQty: (lineId, qty) =>
        set({ items: get().items.map((x) => (x.lineId === lineId ? { ...x, qty: Math.max(1, qty) } : x)), appliedPromo: null }),
      remove: (lineId) => set({ items: get().items.filter((x) => x.lineId !== lineId), appliedPromo: null }),
      clear: () => set({ items: [], appliedPromo: null }),
      applyPromo: (promo) => set({ appliedPromo: promo }),
      removePromo: () => set({ appliedPromo: null }),
    }),
    { name: 'shiraly-cart' },
  ),
);

export function selectSubtotal(items: CartItem[]): number {
  return items.reduce((s, x) => s + x.price * x.qty, 0);
}
export function selectCount(items: CartItem[]): number {
  return items.reduce((s, x) => s + x.qty, 0);
}
export function selectDiscount(appliedPromo: PromoAppliedState | null): number {
  return appliedPromo?.discountAmount ?? 0;
}
export function selectTotal(items: CartItem[], shipping: number, appliedPromo: PromoAppliedState | null): number {
  const subtotal = selectSubtotal(items);
  const discount = selectDiscount(appliedPromo);
  return Math.max(0, subtotal + shipping - discount);
}
