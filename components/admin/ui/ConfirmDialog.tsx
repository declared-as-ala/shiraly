'use client';

import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', danger = false, busy = false,
  onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" onClick={onCancel} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label={title} className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${danger ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-600'}`}>
            <AlertTriangle size={20} />
          </span>
          <div className="flex-1">
            <h3 className="font-heading text-lg font-bold text-ink-900">{title}</h3>
            {message && <p className="mt-1 text-sm text-ink-500">{message}</p>}
          </div>
          <button onClick={onCancel} aria-label="Fermer" className="grid h-8 w-8 place-items-center rounded-full text-ink-500 hover:bg-ink-100"><X size={16} /></button>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm font-bold text-ink-900 hover:bg-ink-100">{cancelLabel}</button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-xl px-4 py-2 text-sm font-bold text-white shadow-soft disabled:opacity-50 ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-500 hover:bg-brand-600'}`}
          >
            {busy ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
