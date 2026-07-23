'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, RefreshCw, RotateCw, Trash2, Truck } from 'lucide-react';
import type { OrderDelivery } from '@/types';

export default function NavexPanel({ orderId }: { orderId: string }) {
  const [delivery, setDelivery] = useState<OrderDelivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOrder = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, { cache: 'no-store' });
      const order = await response.json();
      setDelivery(order?.delivery?.provider === 'navex' ? order.delivery : null);
    } catch {
      setError('Impossible de charger les informations Navex');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { void loadOrder(); }, [loadOrder]);

  async function request(action: 'create' | 'status' | 'delete') {
    if (action === 'delete' && !window.confirm('Supprimer ce colis chez Navex ? Cette action est irréversible.')) return;
    setBusy(action); setError(null);
    try {
      const response = await fetch(action === 'status' ? '/api/admin/navex/status' : '/api/admin/navex/shipment', {
        method: action === 'delete' ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setError(data.error ?? 'Échec Navex');
        await loadOrder();
        return;
      }
      setDelivery(data.delivery ?? delivery);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erreur réseau');
    } finally {
      setBusy(null);
    }
  }

  const tracking = delivery?.trackingNumber;
  const deleted = delivery?.statusCode === 'deleted';

  return (
    <section className="rounded-2xl border border-ink-200 bg-white">
      <header className="flex items-center gap-2 border-b border-ink-200 px-5 py-3">
        <Truck size={16} className="text-brand-500" />
        <h3 className="text-sm font-black uppercase tracking-wide text-ink-900">Navex</h3>
        {tracking && !deleted && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
            <CheckCircle2 size={12} /> Envoyée
          </span>
        )}
      </header>

      <div className="space-y-4 p-5">
        {loading ? <p className="text-sm text-ink-500">Chargement…</p> : (
          <>
            {error && (
              <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600">
                <AlertCircle size={15} /> {error}
              </p>
            )}

            {!tracking ? (
              <div className="space-y-3">
                {delivery?.failed && delivery.error && (
                  <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">
                    <AlertCircle size={15} /> Échec précédent : {delivery.error}
                  </p>
                )}
                <p className="text-sm text-ink-500">Envoyez cette commande à Navex pour générer le colis et son numéro de suivi.</p>
                <button onClick={() => request('create')} disabled={Boolean(busy)} className="btn-primary inline-flex min-h-11 cursor-pointer items-center gap-2 transition disabled:cursor-not-allowed disabled:opacity-50">
                  {delivery?.failed ? <RefreshCw size={16} /> : <Truck size={16} />}
                  {busy === 'create' ? 'Envoi…' : delivery?.failed ? 'Réessayer la création' : 'Envoyer à Navex'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Info label="Numéro de suivi" value={tracking} mono />
                  <Info label="Statut" value={delivery.statusMessage ?? '—'} />
                  <Info label="Dernière synchro" value={delivery.lastSyncAt ? new Date(delivery.lastSyncAt).toLocaleString('fr-FR') : '—'} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {delivery.labelUrl && (
                    <a href={delivery.labelUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm font-bold text-ink-900 transition hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                      <ExternalLink size={15} /> Bon de livraison
                    </a>
                  )}
                  {!deleted && (
                    <>
                      <button onClick={() => request('status')} disabled={Boolean(busy)} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-brand-300 bg-brand-50 px-4 py-2 text-sm font-bold text-brand-700 transition hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50">
                        <RotateCw size={15} /> {busy === 'status' ? 'Mise à jour…' : 'Mettre à jour le statut'}
                      </button>
                      <button onClick={() => request('delete')} disabled={Boolean(busy)} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50">
                        <Trash2 size={15} /> {busy === 'delete' ? 'Suppression…' : 'Supprimer chez Navex'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <div><p className="text-[11px] font-bold uppercase tracking-wide text-ink-500">{label}</p><p className={`mt-0.5 text-sm font-bold text-ink-900 ${mono ? 'font-mono' : ''}`}>{value}</p></div>;
}
