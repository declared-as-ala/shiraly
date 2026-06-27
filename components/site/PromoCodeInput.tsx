'use client';

import { useState, useTransition } from 'react';
import { useCart } from '@/lib/cart';
import { formatPrice } from '@/lib/site-config';
import { useLanguage } from '@/components/site/LanguageProvider';
import { Tag, X, Loader2, Check } from 'lucide-react';

export default function PromoCodeInput() {
  const { t } = useLanguage();
  const items = useCart((s) => s.items);
  const appliedPromo = useCart((s) => s.appliedPromo);
  const applyPromo = useCart((s) => s.applyPromo);
  const removePromo = useCart((s) => s.removePromo);

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const subtotal = items.reduce((s, x) => s + x.price * x.qty, 0);

  async function handleApply() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed, items }),
      });
      const data = await res.json();
      if (data.valid) {
        applyPromo({
          code: data.code,
          type: data.type,
          value: data.value,
          discountAmount: data.discountAmount,
          description: data.description,
        });
        setSuccess(t.cart.promoApplied);
        setCode('');
      } else {
        setError(data.error || t.cart.promoInvalid);
      }
    } catch {
      setError(t.cart.promoInvalid);
    } finally {
      setLoading(false);
    }
  }

  function handleRemove() {
    removePromo();
    setError('');
    setSuccess('');
    setCode('');
  }

  if (appliedPromo) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-200 text-emerald-700">
              <Check size={16} />
            </span>
            <div>
              <p className="text-sm font-bold text-emerald-800">
                {appliedPromo.code}
              </p>
              {appliedPromo.description && (
                <p className="mt-0.5 text-xs text-emerald-600">{appliedPromo.description}</p>
              )}
              <p className="mt-1 text-xs text-ink-500">
                {t.cart.promoDiscount}: -{formatPrice(appliedPromo.discountAmount)}
              </p>
            </div>
          </div>
          <button
            onClick={handleRemove}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-emerald-600 hover:bg-emerald-200"
            aria-label={t.cart.promoRemove}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-700">
        <Tag size={14} />
        {t.cart.promoCode}
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(''); setSuccess(''); }}
          onKeyDown={(e) => e.key === 'Enter' && handleApply()}
          placeholder={t.cart.promoPlaceholder}
          className="input flex-1 uppercase"
          disabled={loading}
          aria-label={t.cart.promoCode}
        />
        <button
          onClick={handleApply}
          disabled={loading || !code.trim()}
          className="btn-primary shrink-0 disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : t.cart.promoApply}
        </button>
      </div>
      {error && (
        <p className="mt-1.5 text-xs font-semibold text-red-600" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-1.5 text-xs font-semibold text-emerald-600" role="status">
          {success}
        </p>
      )}
    </div>
  );
}
