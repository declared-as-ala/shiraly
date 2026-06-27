'use client';

import { useCallback, useEffect, useState } from 'react';
import { Truck, RefreshCw, Printer, RotateCw, Clock, AlertCircle, CheckCircle2, History } from 'lucide-react';
import type { OrderDelivery } from '@/types';

type TrackEvent = { date: string | null; statusCode: string | null; statusMessage: string | null; statusLabel?: string | null };

/**
 * Best Delivery controls for a single order, shown inside the admin OrderDrawer.
 * Fetches the order's stored delivery info, then offers create/retry/print/
 * status-refresh + history timeline. All network calls hit backend admin routes.
 */
export default function BestDeliveryPanel({ orderId }: { orderId: string }) {
  const [delivery, setDelivery] = useState<OrderDelivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<TrackEvent[] | null>(null);

  const loadOrder = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/orders/${orderId}`, { cache: 'no-store' });
      const o = await r.json();
      setDelivery(o?.delivery ?? null);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => { if (orderId) loadOrder(); }, [orderId, loadOrder]);

  async function sendPickup() {
    setBusy('pickup'); setError(null);
    try {
      const r = await fetch('/api/admin/best-delivery/pickup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) { setError(d.error ?? 'Échec de création'); await loadOrder(); return; }
      setDelivery(d.delivery);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau');
    } finally { setBusy(null); }
  }

  async function refreshStatus() {
    setBusy('status'); setError(null);
    try {
      const r = await fetch('/api/admin/best-delivery/status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) { setError(d.error ?? 'Erreur de suivi'); return; }
      setDelivery((prev) => ({ ...(prev as OrderDelivery), ...d.delivery }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau');
    } finally { setBusy(null); }
  }

  async function loadHistory() {
    setBusy('history'); setError(null);
    try {
      const r = await fetch(`/api/admin/best-delivery/track?orderId=${encodeURIComponent(orderId)}`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok || !d.ok) { setError(d.error ?? 'Erreur historique'); return; }
      setEvents(d.events ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau');
    } finally { setBusy(null); }
  }

  const tracking = delivery?.trackingNumber;
  const failed = delivery?.failed;

  return (
    <section className="rounded-2xl border border-ink-200 bg-white">
      <header className="flex items-center gap-2 border-b border-ink-200 px-5 py-3">
        <Truck size={16} className="text-brand-500" />
        <h3 className="text-sm font-black uppercase tracking-wide text-ink-900">Best Delivery</h3>
        {tracking && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
            <CheckCircle2 size={12} /> Envoyée
          </span>
        )}
      </header>

      <div className="space-y-4 p-5">
        {loading ? (
          <p className="text-sm text-ink-500">Chargement…</p>
        ) : (
          <>
            {error && (
              <p className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600">
                <AlertCircle size={15} /> {error}
              </p>
            )}

            {!tracking ? (
              <div className="space-y-3">
                {failed && delivery?.error && (
                  <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">
                    <AlertCircle size={15} /> Échec précédent : {delivery.error}
                  </p>
                )}
                <p className="text-sm text-ink-500">
                  Envoyez cette commande à Best Delivery pour générer un bordereau et un numéro de suivi.
                </p>
                <button
                  onClick={sendPickup}
                  disabled={busy === 'pickup'}
                  className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {failed ? <RefreshCw size={16} /> : <Truck size={16} />}
                  {busy === 'pickup' ? 'Envoi…' : failed ? 'Réessayer la création' : 'Envoyer à Best Delivery'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Info label="Numéro de suivi" value={tracking} mono />
                  <Info label="Statut" value={delivery?.statusMessage ? `${delivery.statusMessage}${delivery.statusCode ? ` (${delivery.statusCode})` : ''}` : '—'} />
                  <Info label="Dernière synchro" value={delivery?.lastSyncAt ? new Date(delivery.lastSyncAt).toLocaleString('fr-FR') : '—'} />
                </div>

                {delivery?.labelUrl && (
                  <p className="rounded-lg bg-sand-100 px-3 py-2 text-xs text-ink-500">
                    Le bon de livraison s&apos;ouvre sur best-delivery.net. Connectez-vous à votre compte expéditeur dans le même navigateur, puis imprimez (Ctrl/Cmd + P).
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {delivery?.labelUrl && (
                    <a
                      href={delivery.labelUrl}
                      target="_blank"
                      rel="noopener"
                      title="Ouvre le bon de livraison sur best-delivery.net (connexion à votre compte expéditeur requise)"
                      className="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm font-bold text-ink-900 hover:bg-ink-100"
                    >
                      <Printer size={15} /> Bon de livraison
                    </a>
                  )}
                  <button
                    onClick={refreshStatus}
                    disabled={busy === 'status'}
                    className="inline-flex items-center gap-2 rounded-xl border border-brand-300 bg-brand-50 px-4 py-2 text-sm font-bold text-brand-700 hover:bg-brand-100 disabled:opacity-50"
                  >
                    <RotateCw size={15} /> {busy === 'status' ? 'Mise à jour…' : 'Mettre à jour le statut'}
                  </button>
                  <button
                    onClick={loadHistory}
                    disabled={busy === 'history'}
                    className="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm font-bold text-ink-900 hover:bg-ink-100 disabled:opacity-50"
                  >
                    <History size={15} /> {busy === 'history' ? 'Chargement…' : 'Historique'}
                  </button>
                </div>

                {events && (
                  events.length === 0 ? (
                    <p className="text-sm text-ink-500">Aucun évènement de suivi pour le moment.</p>
                  ) : (
                    <ol className="relative space-y-3 border-s-2 border-ink-200 ps-4">
                      {events.map((ev, i) => (
                        <li key={i} className="relative">
                          <span className="absolute -start-[1.30rem] top-1 grid h-3 w-3 place-items-center rounded-full bg-brand-500 ring-2 ring-white" />
                          <p className="text-sm font-bold text-ink-900">{ev.statusLabel ?? ev.statusMessage ?? ev.statusCode ?? '—'}</p>
                          <p className="flex items-center gap-1 text-xs text-ink-500">
                            <Clock size={11} /> {ev.date ?? '—'}{ev.statusCode ? ` · code ${ev.statusCode}` : ''}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-ink-500">{label}</p>
      <p className={`mt-0.5 text-sm font-bold text-ink-900 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}
