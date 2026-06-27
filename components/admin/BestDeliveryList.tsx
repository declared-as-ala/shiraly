'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Truck, AlertCircle } from 'lucide-react';
import { PageHeader, EmptyState } from '@/components/admin/ui';

type ApiResult = {
  hasErrors?: boolean;
  errorsTxt?: string | null;
  totalPages?: number;
  currentPage?: number;
  items?: Record<string, string | null>[];
  error?: string;
};

/**
 * Generic paginated viewer for Best Delivery list endpoints (orders / recettes).
 * Columns are derived dynamically from the returned records.
 */
export default function BestDeliveryList({
  endpoint, title, subtitle,
}: {
  endpoint: 'orders' | 'recettes';
  title: string;
  subtitle: string;
}) {
  const [page, setPage] = useState(1);
  const [ofset, setOfset] = useState(20);
  const [data, setData] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`/api/admin/best-delivery/${endpoint}?page=${page}&ofset=${ofset}`, { cache: 'no-store' });
      const d: ApiResult = await r.json();
      if (!r.ok) { setError(d.error ?? 'Erreur'); setData(null); return; }
      if (d.hasErrors) setError(d.errorsTxt ?? 'Le service a renvoyé une erreur.');
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau');
      setData(null);
    } finally { setLoading(false); }
  }, [endpoint, page, ofset]);

  useEffect(() => { load(); }, [load]);

  const items = data?.items ?? [];
  const columns = Array.from(new Set(items.flatMap((it) => Object.keys(it))));
  const totalPages = data?.totalPages ?? 1;
  const currentPage = data?.currentPage ?? page;

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Best Delivery' }, { label: title }]}
        actions={
          <button onClick={load} disabled={loading} className="btn-ghost inline-flex items-center gap-2">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm font-bold text-ink-700">Par page</label>
        <select value={ofset} onChange={(e) => { setOfset(Number(e.target.value)); setPage(1); }} className="input w-24">
          {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {error && (
        <p className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600">
          <AlertCircle size={15} /> {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-ink-100" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Truck} title="Aucune donnée" description="Best Delivery n'a renvoyé aucun enregistrement pour cette page." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand-200 text-xs uppercase text-ink-700">
              <tr>{columns.map((c) => <th key={c} className="px-4 py-3 text-left font-bold">{c}</th>)}</tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-t border-ink-200 hover:bg-sand-100">
                  {columns.map((c) => <td key={c} className="px-4 py-3 text-ink-900">{it[c] ?? '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-ink-500">Page {currentPage} / {totalPages}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1 || loading}
            className="inline-flex items-center gap-1 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-bold text-ink-900 hover:bg-ink-100 disabled:opacity-40"
          >
            <ChevronLeft size={15} /> Préc.
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages || loading}
            className="inline-flex items-center gap-1 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-bold text-ink-900 hover:bg-ink-100 disabled:opacity-40"
          >
            Suiv. <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
