'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Eye, Edit, Trash2, Package, AlertTriangle, Plus, Search, X, GripVertical } from 'lucide-react';
import ProductDrawer from './ProductDrawer';
import { useToast } from './Toast';
import { formatPrice } from '@/lib/site-config';
import { scoreProductSeo, STATUS_LABEL, type SeoStatus } from '@/lib/seo-score';
import type { Product } from '@/types';

const SEO_TONE: Record<SeoStatus, string> = {
  poor: 'bg-red-50 text-red-700 ring-red-200',
  fair: 'bg-amber-50 text-amber-700 ring-amber-200',
  good: 'bg-blue-50 text-blue-700 ring-blue-200',
  excellent: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

function SeoBadge({ product }: { product: Product }) {
  const { score, status } = scoreProductSeo({
    name: product.name,
    slug: product.slug,
    metaTitle: product.metaTitle,
    metaDescription: product.metaDescription,
    focusKeyword: product.focusKeyword,
    description: product.description,
    hasImage: product.images.length > 0,
    imageAlt: product.images[0]?.alt,
  });
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${SEO_TONE[status]}`} title={STATUS_LABEL[status]}>
      {score} <span className="hidden sm:inline">· {STATUS_LABEL[status]}</span>
    </span>
  );
}

type Props = {
  initialProducts: Product[];
  totals: { stock: number; outOfStock: number; revenuePotential: number };
};

export default function ProduitsView({ initialProducts, totals }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [products, setProducts] = useState(initialProducts);
  useEffect(() => { setProducts(initialProducts); }, [initialProducts]);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragEnabled = !query.trim() && !statusFilter;

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        p.id,
        p.name,
        p.slug,
        ...(p.categorySlugs ?? []),
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [products, query, statusFilter]);

  function openCreate() { setEditingId(null); setDrawerOpen(true); }
  function openEdit(id: string) { setEditingId(id); setDrawerOpen(true); }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(filteredProducts.map((p) => p.id)) : new Set());
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Supprimer « ${name} » ? Le produit sera mis à la corbeille.`)) return;
    const snapshot = products;
    setProducts((prev) => prev.filter((p) => p.id !== id));
    const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    if (!res.ok) { setProducts(snapshot); toast.error('Erreur de suppression'); return; }
    toast.success(`« ${name} » supprimé`);
    startTransition(() => router.refresh());
  }

  async function bulkDelete() {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (!confirm(`Supprimer ${ids.length} produit${ids.length > 1 ? 's' : ''} ?`)) return;
    const snapshot = products;
    setProducts((prev) => prev.filter((p) => !selected.has(p.id)));
    setSelected(new Set());

    const results = await Promise.allSettled(
      ids.map((id) => fetch(`/api/admin/products/${id}`, { method: 'DELETE' }).then((r) => (r.ok ? id : Promise.reject(id)))),
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    if (ok) toast.success(`${ok} produit${ok > 1 ? 's' : ''} supprimé${ok > 1 ? 's' : ''}`);
    if (failed) {
      toast.error(`${failed} échec${failed > 1 ? 's' : ''}`);
      setProducts(snapshot);
    }
    startTransition(() => router.refresh());
  }

  function applySavedProduct(p: Product) {
    setProducts((prev) => {
      const idx = prev.findIndex((x) => x.id === p.id);
      if (idx >= 0) { const next = prev.slice(); next[idx] = p; return next; }
      return [p, ...prev];
    });
    toast.success(`« ${p.name} » enregistré`);
    startTransition(() => router.refresh());
  }

  const allChecked = filteredProducts.length > 0 && filteredProducts.every((p) => selected.has(p.id));
  const someChecked = filteredProducts.some((p) => selected.has(p.id)) && !allChecked;

  return (
    <div className="p-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-black">Produits</h1>
        <button onClick={openCreate} className="btn-primary inline-flex items-center gap-2">
          <Plus size={16} /> Ajouter un produit
        </button>
      </header>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="card flex items-center gap-4 p-5">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-sand-200 text-brand-500"><Package /></div>
          <div><p className="text-3xl font-black">{totals.stock}</p><p className="text-sm text-ink-700">Stock total</p></div>
        </div>
        <div className="card flex items-center gap-4 p-5">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-red-100 text-red-600"><AlertTriangle /></div>
          <div><p className="text-3xl font-black">{totals.outOfStock}</p><p className="text-sm text-ink-700">Ruptures</p></div>
        </div>
        <div className="card flex items-center justify-end gap-4 bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-sand-50">
          <div className="text-right">
            <p className="text-sm opacity-90">Revenu estimé</p>
            <p className="text-2xl font-black">{formatPrice(totals.revenuePotential)}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-700" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher (ID, nom, slug, catégorie)…"
            className="input pl-9"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-700 hover:bg-ink-100"
              aria-label="Effacer"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input w-48"
        >
          <option value="">Tous les statuts</option>
          <option value="published">Affiché</option>
          <option value="draft">Brouillon</option>
          <option value="private">Privé</option>
        </select>
        {(query || statusFilter) && (
          <button onClick={() => { setQuery(''); setStatusFilter(''); }} className="btn-ghost">
            Réinitialiser
          </button>
        )}
        <div className="ml-auto flex items-center gap-3">
          {selected.size > 0 && (
            <>
              <span className="text-sm font-bold text-ink-900">{selected.size} sélectionné{selected.size > 1 ? 's' : ''}</span>
              <button
                onClick={bulkDelete}
                className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white shadow-soft hover:bg-red-600"
              >
                <Trash2 size={14} /> Supprimer la sélection
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-sand-200 text-xs uppercase text-ink-700">
            <tr>
              {dragEnabled && <th className="w-8 px-2 py-3"></th>}
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-500"
                  checked={allChecked}
                  ref={(el) => { if (el) el.indeterminate = someChecked; }}
                  onChange={(e) => toggleAll(e.target.checked)}
                  aria-label="Tout sélectionner"
                />
              </th>
              <th className="px-4 py-3 text-left">ID</th>
              <th className="px-4 py-3 text-left">Image</th>
              <th className="px-4 py-3 text-left">Nom</th>
              <th className="px-4 py-3 text-left">Prix</th>
              <th className="px-4 py-3 text-left">Stock</th>
              <th className="px-4 py-3 text-left">Statut</th>
              <th className="px-4 py-3 text-left">SEO</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((p, index) => {
              const isSelected = selected.has(p.id);
              const tone =
                p.status === 'published' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' :
                p.status === 'draft' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' :
                'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
              return (
                <tr
                  key={p.id}
                  draggable={dragEnabled}
                  onDragStart={(e) => {
                    setDraggedIndex(index);
                    e.dataTransfer.setData('text/plain', index.toString());
                  }}
                  onDragEnd={() => {
                    setDraggedIndex(null);
                    setDragOverIndex(null);
                  }}
                  onDragOver={(e) => {
                    if (dragEnabled) e.preventDefault();
                  }}
                  onDragEnter={() => {
                    if (dragEnabled && draggedIndex !== null) {
                      setDragOverIndex(index);
                    }
                  }}
                  onDrop={async (e) => {
                    if (!dragEnabled || draggedIndex === null) return;
                    const sourceIndex = draggedIndex;
                    const targetIndex = index;
                    if (sourceIndex === targetIndex) return;

                    const reordered = [...products];
                    const [removed] = reordered.splice(sourceIndex, 1);
                    reordered.splice(targetIndex, 0, removed);
                    
                    setProducts(reordered);
                    setDraggedIndex(null);
                    setDragOverIndex(null);

                    const updates = reordered.map((prod, i) => ({ id: prod.id, menuOrder: i }));
                    try {
                      const res = await fetch('/api/admin/products', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ items: updates }),
                      });
                      if (!res.ok) throw new Error();
                      toast.success('Ordre des produits mis à jour');
                    } catch {
                      toast.error("Erreur lors de la mise à jour de l'ordre");
                      startTransition(() => router.refresh());
                    }
                  }}
                  className={`border-t border-ink-200 transition ${isSelected ? 'bg-brand-50/60' : 'hover:bg-sand-100'} ${pending ? 'opacity-60' : ''} ${draggedIndex === index ? 'opacity-40 bg-brand-50' : ''} ${dragOverIndex === index && draggedIndex !== index ? 'border-t-2 border-t-brand-500' : ''}`}
                >
                  {dragEnabled && (
                    <td className="px-2 py-3 cursor-grab active:cursor-grabbing text-ink-700 hover:text-ink-950 drag-handle">
                      <GripVertical size={16} />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-500"
                      checked={isSelected}
                      onChange={() => toggleOne(p.id)}
                      aria-label={`Sélectionner ${p.name}`}
                    />
                  </td>
                  <td className="px-4 py-3 font-bold">{p.id}</td>
                  <td className="px-4 py-3">
                    {p.images[0]?.url ? (
                      <Image src={p.images[0].url} alt={p.name} width={40} height={50} className="rounded-lg object-cover" />
                    ) : (
                      <div className="h-12 w-10 rounded-lg bg-ink-200" />
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold">{p.name}</td>
                  <td className="px-4 py-3">{formatPrice(p.price)}</td>
                  <td className="px-4 py-3">{p.stockQuantity ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${tone}`}>
                      {p.status === 'published' ? 'Affiché' : p.status === 'draft' ? 'Brouillon' : 'Privé'}
                    </span>
                  </td>
                  <td className="px-4 py-3"><SeoBadge product={p} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(p.id)} className="rounded-lg p-2 text-ink-700 hover:bg-ink-100" title="Voir"><Eye size={16} /></button>
                      <button onClick={() => openEdit(p.id)} className="rounded-lg p-2 text-ink-700 hover:bg-ink-100" title="Modifier"><Edit size={16} /></button>
                      <button onClick={() => remove(p.id, p.name)} className="rounded-lg p-2 text-red-500 hover:bg-red-50" title="Supprimer"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!filteredProducts.length && (
              <tr>
                <td colSpan={dragEnabled ? 10 : 9} className="p-8 text-center text-ink-700">
                  {products.length === 0 ? 'Aucun produit.' : 'Aucun résultat.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ProductDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        productId={editingId}
        onSaved={applySavedProduct}
      />
    </div>
  );
}
