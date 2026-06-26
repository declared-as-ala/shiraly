'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WishlistItem = {
  id: string;
  slug: string;
  name: string;
  price: number;
  image: string;
};

type WishlistState = {
  items: WishlistItem[];
  toggle: (item: WishlistItem) => void;
  remove: (id: string) => void;
  has: (id: string) => boolean;
  clear: () => void;
};

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      toggle: (item) => {
        const exists = get().items.some((x) => x.id === item.id);
        set({
          items: exists
            ? get().items.filter((x) => x.id !== item.id)
            : [...get().items, item],
        });
      },
      remove: (id) => set({ items: get().items.filter((x) => x.id !== id) }),
      has: (id) => get().items.some((x) => x.id === id),
      clear: () => set({ items: [] }),
    }),
    { name: 'shiraly-wishlist' },
  ),
);
