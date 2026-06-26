'use client';

import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { useWishlist, type WishlistItem } from '@/lib/wishlist';

export default function WishlistButton({
  item,
  className = '',
}: {
  item: WishlistItem;
  className?: string;
}) {
  const toggle = useWishlist((s) => s.toggle);
  const items = useWishlist((s) => s.items);
  // Avoid hydration mismatch: only reflect persisted state after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const active = mounted && items.some((x) => x.id === item.id);

  return (
    <button
      type="button"
      aria-label={active ? 'Retirer de la liste de souhaits' : 'Ajouter à la liste de souhaits'}
      aria-pressed={active}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(item);
      }}
      className={`grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink-900 shadow-sm backdrop-blur transition hover:scale-110 hover:bg-white ${className}`}
    >
      <Heart size={16} className={active ? 'fill-brand-600 text-brand-600' : ''} />
    </button>
  );
}
