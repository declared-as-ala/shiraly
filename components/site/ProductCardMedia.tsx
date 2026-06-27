'use client';

import { useEffect, useRef, useState } from 'react';
import { Images } from 'lucide-react';

/**
 * Product image with a "hover/second photo" that works on touch too.
 * - Mouse devices: reveal on pointer hover (classic).
 * - Touch devices (no hover): auto-reveal the alternate photo when the card
 *   scrolls into focus (IntersectionObserver with hysteresis), and instantly on
 *   any touch — so even an accidental graze shows how the item is worn.
 * - Respects prefers-reduced-motion (no zoom, instant swap).
 */
export default function ProductCardMedia({
  img, hoverImg, alt, discount, inStock, outOfStockLabel,
}: {
  img?: string;
  hoverImg?: string | null;
  alt: string;
  discount: number;
  inStock: boolean;
  outOfStockLabel: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    if (!hoverImg) return;
    const el = ref.current;
    if (!el || typeof window === 'undefined') return;

    setReduce(window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    // Only touch / no-hover devices get the scroll auto-reveal; mouse uses hover.
    if (!window.matchMedia('(hover: none)').matches) return;

    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e) return;
        if (e.intersectionRatio >= 0.8) setRevealed(true);
        else if (e.intersectionRatio <= 0.4) setRevealed(false);
      },
      { threshold: [0, 0.4, 0.8, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hoverImg]);

  const swap = (next: boolean) => hoverImg && setRevealed(next);

  return (
    <div
      ref={ref}
      onPointerEnter={(e) => e.pointerType === 'mouse' && swap(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && swap(false)}
      onTouchStart={() => swap(true)}
      className="relative w-full overflow-hidden bg-sand-200"
    >
      <div style={{ paddingBottom: '125%' }} />

      {img && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={img}
          alt={alt}
          className={`absolute inset-0 h-full w-full object-cover transition duration-500 ${
            hoverImg ? (revealed ? 'opacity-0' : 'opacity-100') : revealed && !reduce ? 'scale-105' : ''
          }`}
          loading="lazy"
        />
      )}
      {hoverImg && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={hoverImg}
          alt={alt}
          className={`absolute inset-0 h-full w-full object-cover transition duration-500 ${
            revealed ? 'opacity-100 scale-100' : `opacity-0 ${reduce ? '' : 'scale-105'}`
          }`}
          loading="lazy"
        />
      )}

      {discount > 0 && (
        <span className="absolute start-2 top-2 z-10 rounded-md bg-brand-600 px-2 py-0.5 text-[11px] font-black text-sand-50 shadow">
          -{discount}%
        </span>
      )}
      {!inStock && (
        <span className="absolute start-2 bottom-2 z-10 rounded-md bg-ink-900/85 px-2 py-0.5 text-[11px] font-bold text-white">
          {outOfStockLabel}
        </span>
      )}

      {/* Hint that a second photo exists — fades out once revealed */}
      {hoverImg && (
        <span
          aria-hidden
          className={`pointer-events-none absolute end-2 bottom-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-white/85 text-ink-900 shadow-sm backdrop-blur transition-opacity duration-300 ${
            revealed ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <Images size={14} />
        </span>
      )}
    </div>
  );
}
