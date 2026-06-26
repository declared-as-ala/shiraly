'use client';
import { create } from 'zustand';

/**
 * Ephemeral UI state for the slide-in cart drawer.
 * Kept separate from the persisted cart store (lib/cart.tsx) so the
 * open/close state is never written to localStorage.
 */
type CartUIState = {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
};

export const useCartUI = create<CartUIState>((set) => ({
  open: false,
  openDrawer: () => set({ open: true }),
  closeDrawer: () => set({ open: false }),
  toggleDrawer: () => set((s) => ({ open: !s.open })),
}));
