'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { formatPrice } from '@/lib/site-config';

type Result = {
  id: string;
  name: string;
  slug: string;
  price: number;
  regularPrice: number;
  image: string | null;
};

export default function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function onChange(value: string) {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (value.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(value.trim())}`);
        if (res.ok) setResults(await res.json());
      } catch {} finally { setLoading(false); }
    }, 300);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 pt-[15vh] backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-ink-200 px-5 py-4">
          <Search size={18} className="text-ink-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Rechercher un produit..."
            className="flex-1 bg-transparent text-base font-medium text-ink-900 outline-none placeholder:text-ink-400"
          />
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-ink-100">
            <X size={18} className="text-ink-500" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {loading && (
            <p className="px-3 py-6 text-center text-sm text-ink-500">Recherche...</p>
          )}
          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-ink-500">Aucun résultat pour « {query} »</p>
          )}
          {results.map((r) => (
            <Link
              key={r.id}
              href={`/produit/${r.slug}`}
              onClick={onClose}
              className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-ink-100"
            >
              {r.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.image} alt="" className="h-12 w-12 flex-none rounded-lg object-cover" />
              ) : (
                <div className="h-12 w-12 flex-none rounded-lg bg-ink-200" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink-900">{r.name}</p>
                <p className="text-sm font-bold text-brand-600">
                  {r.price !== r.regularPrice && (
                    <span className="mr-1 text-xs text-ink-400 line-through">{formatPrice(r.regularPrice)}</span>
                  )}
                  {formatPrice(r.price)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
