'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, X, Edit, Trash2, Eye, Copy, ToggleLeft, ToggleRight, Percent, DollarSign } from 'lucide-react';
import { useToast } from './Toast';
import { formatPrice } from '@/lib/site-config';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { PageHeader, StatusBadge, EmptyState, Skeleton } from './ui';
import type { PromoCodeData } from '@/types';

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusInfo(p: PromoCodeData): { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' } {
  if (!p.active) return { label: 'Inactif', tone: 'neutral' };
  if (p.expiresAt && new Date(p.expiresAt) < new Date()) return { label: 'Expiré', tone: 'danger' };
  if (p.startsAt && new Date(p.startsAt) > new Date()) return { label: 'À venir', tone: 'info' };
  if (p.usageLimit && p.usageCount >= p.usageLimit) return { label: 'Épuisé', tone: 'warning' };
  return { label: 'Actif', tone: 'success' };
}

type Props = {
  initialPromos: PromoCodeData[];
  total: number;
  totalPages: number;
  page: number;
};

export default function PromoCodesView({ initialPromos, total, totalPages, page }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [promos, setPromos] = useState(initialPromos);
  useEffect(() => { setPromos(initialPromos); }, [initialPromos]);

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PromoCodeData | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return promos.filter((p) => {
      if (statusFilter === 'active' && !p.active) return false;
      if (statusFilter === 'inactive' && p.active) return false;
      if (statusFilter === 'expired' && p.expiresAt && new Date(p.expiresAt) >= new Date()) return false;
      if (statusFilter === 'expired' && !p.expiresAt) return false;
      if (typeFilter && p.type !== typeFilter) return false;
      if (!q) return true;
      return p.code.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q);
    });
  }, [promos, query, typeFilter, statusFilter]);

  async function handleToggle(id: string) {
    const snapshot = promos;
    setPromos((prev) => prev.map((p) => p.id === id ? { ...p, active: !p.active } : p));
    const res = await fetch(`/api/admin/promo-codes/${id}/toggle`, { method: 'POST' });
    if (!res.ok) { setPromos(snapshot); toast.error('Erreur'); return; }
    const updated = await res.json();
    setPromos((prev) => prev.map((p) => p.id === id ? updated : p));
    toast.success(updated.active ? 'Code activé' : 'Code désactivé');
  }

  async function handleDuplicate(p: PromoCodeData) {
    const newCode = `${p.code}_COPY`;
    const res = await fetch('/api/admin/promo-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: newCode,
        type: p.type,
        value: p.value,
        description: p.description ? `Copie de ${p.code}` : '',
        minimumOrderAmount: p.minimumOrderAmount,
        maximumDiscountAmount: p.maximumDiscountAmount,
        startsAt: p.startsAt,
        expiresAt: p.expiresAt,
        usageLimit: p.usageLimit,
        active: false,
        applicableTo: p.applicableTo,
        selectedProductIds: p.selectedProductIds,
        selectedCategoryIds: p.selectedCategoryIds,
      }),
    });
    if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Erreur de duplication'); return; }
    toast.success('Code dupliqué');
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/promo-codes/${deleteTarget.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Erreur de suppression'); setDeleting(false); setDeleteTarget(null); return; }
    setPromos((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    toast.success(`« ${deleteTarget.code} » supprimé`);
    setDeleting(false);
    setDeleteTarget(null);
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Codes promo"
        subtitle={`${total} code${total > 1 ? 's' : ''} — Page ${page}/${totalPages}`}
        actions={
          <button onClick={() => router.push('/admin/promo-codes/create')} className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} /> Nouveau code
          </button>
        }
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Codes promo' },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-700" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par code ou description…"
            className="input pl-9"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-700 hover:bg-ink-100" aria-label="Effacer">
              <X size={14} />
            </button>
          )}
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input w-40">
          <option value="">Tous les types</option>
          <option value="PERCENTAGE">Pourcentage</option>
          <option value="FIXED_AMOUNT">Montant fixe</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input w-44">
          <option value="">Tous les statuts</option>
          <option value="active">Actif</option>
          <option value="inactive">Inactif</option>
          <option value="expired">Expiré</option>
        </select>
        {(query || typeFilter || statusFilter) && (
          <button onClick={() => { setQuery(''); setTypeFilter(''); setStatusFilter(''); }} className="btn-ghost">
            Réinitialiser
          </button>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-sand-200 text-xs uppercase text-ink-700">
            <tr>
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Valeur</th>
              <th className="px-4 py-3 text-left">Statut</th>
              <th className="px-4 py-3 text-left">Validité</th>
              <th className="px-4 py-3 text-left">Utilisations</th>
              <th className="px-4 py-3 text-left">Min. commande</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const si = statusInfo(p);
              return (
                <tr key={p.id} className="border-t border-ink-200 hover:bg-sand-100 transition">
                  <td className="px-4 py-3 font-bold text-brand-700">{p.code}</td>
                  <td className="px-4 py-3">
                    {p.type === 'PERCENTAGE' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold"><Percent size={12} /> Pourcentage</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold"><DollarSign size={12} /> Montant fixe</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {p.type === 'PERCENTAGE' ? `${p.value}%` : formatPrice(p.value)}
                  </td>
                  <td className="px-4 py-3"><StatusBadge tone={si.tone}>{si.label}</StatusBadge></td>
                  <td className="px-4 py-3 text-ink-700">
                    {p.startsAt || p.expiresAt ? (
                      <span className="text-xs">{formatDate(p.startsAt)} — {formatDate(p.expiresAt)}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold">{p.usageCount}</span>
                    {p.usageLimit ? <span className="text-ink-500"> / {p.usageLimit}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-ink-700">{p.minimumOrderAmount ? formatPrice(p.minimumOrderAmount) : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => router.push(`/admin/promo-codes/${p.id}`)} className="rounded-lg p-2 text-ink-700 hover:bg-ink-100" title="Voir">
                        <Eye size={16} />
                      </button>
                      <button onClick={() => router.push(`/admin/promo-codes/${p.id}`)} className="rounded-lg p-2 text-ink-700 hover:bg-ink-100" title="Modifier">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleToggle(p.id)} className="rounded-lg p-2 text-ink-700 hover:bg-ink-100" title={p.active ? 'Désactiver' : 'Activer'}>
                        {p.active ? <ToggleRight size={16} className="text-emerald-600" /> : <ToggleLeft size={16} />}
                      </button>
                      <button onClick={() => handleDuplicate(p)} className="rounded-lg p-2 text-ink-700 hover:bg-ink-100" title="Dupliquer">
                        <Copy size={16} />
                      </button>
                      <button onClick={() => setDeleteTarget(p)} className="rounded-lg p-2 text-red-500 hover:bg-red-50" title="Supprimer">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr>
                <td colSpan={8} className="p-8">
                  <EmptyState title="Aucun code promo" description={promos.length === 0 ? 'Créez votre premier code promo.' : 'Aucun résultat pour cette recherche.'} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => router.push(`/admin/promo-codes?page=${p}`)}
              className={`grid h-9 w-9 place-items-center rounded-xl text-sm font-bold transition ${p === page ? 'bg-brand-500 text-white' : 'bg-white text-ink-700 hover:bg-ink-100'}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Supprimer « ${deleteTarget?.code} »`}
        message="Cette action est irréversible. Les codes promo déjà utilisés ne seront pas affectés sur les commandes existantes."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        danger
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => { setDeleteTarget(null); setDeleting(false); }}
      />
    </div>
  );
}
