'use client';
import { useEffect, useState } from 'react';
import Drawer from './Drawer';
import MultiCheckSelect from './MultiCheckSelect';
import ImageUploader from './ImageUploader';
import NumberField from './NumberField';
import { Save, Copy, Trash2, Plus, X, GripVertical, Upload } from 'lucide-react';
import type { Product, ProductBundle } from '@/types';
import { scoreProductSeo, statusFromScore, STATUS_LABEL, type SeoStatus } from '@/lib/seo-score';

type Tab = 'description' | 'options' | 'bundles' | 'related' | 'seo' | 'reviews';

type FormState = {
  name: string;
  slug: string;
  sku: string;
  categoryIds: string[];
  manageStock: boolean;
  stockQuantity: number;
  regularPrice: number;
  salePrice: number;
  cost: number;
  deliveryPrice: number;
  deliveryCost: number;
  description: string;
  status: 'published' | 'draft' | 'private';
  images: { id: string; url: string }[];
  hoverImage: string | null;
  options: { label: string; type: 'text' | 'select' | 'radio'; values: string[] }[];
  bundles: ProductBundle[];
  upsellIds: string[];
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  imageAlt: string;
};

const EMPTY: FormState = {
  name: '', slug: '', sku: '', categoryIds: [], manageStock: false, stockQuantity: 0,
  regularPrice: 0, salePrice: 0, cost: 0, deliveryPrice: 0, deliveryCost: 0,
  description: '', status: 'published', images: [], hoverImage: null,
  options: [], bundles: [], upsellIds: [],
  metaTitle: '', metaDescription: '', focusKeyword: '', imageAlt: '',
};

type Props = {
  open: boolean;
  onClose: () => void;
  productId?: string | null;
  onSaved?: (p: Product) => void;
};

export default function ProductDrawer({ open, onClose, productId, onSaved }: Props) {
  const isEdit = Boolean(productId);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('description');
  const [form, setForm] = useState<FormState>(EMPTY);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    if (!categories.length) {
      fetch('/api/admin/categories').then(async (r) => r.ok && setCategories(await r.json())).catch(() => {});
    }
      if (productId) {
      setLoading(true);
      fetch(`/api/admin/products/${productId}`)
        .then((r) => r.json())
        .then((p: Product) => {
          const options = (p.attributes ?? []).map((a) => ({
            label: a.name,
            type: a.variation ? 'select' : 'text' as const,
            values: a.options,
          }));
          setForm({
            name: p.name,
            slug: p.slug ?? '',
            sku: (p.meta?._sku as string) ?? '',
            categoryIds: p.categoryIds,
            manageStock: p.stockQuantity !== null,
            stockQuantity: p.stockQuantity ?? 0,
            regularPrice: p.regularPrice,
            salePrice: p.salePrice ?? p.price,
            cost: Number(p.meta?._mzem_cost ?? 0),
            deliveryPrice: Number(p.meta?._mzem_delivery_price ?? 0),
            deliveryCost: Number(p.meta?._mzem_delivery_cost ?? 0),
            description: p.description,
            status: p.status,
            images: p.images.map((i) => ({ id: i.id, url: i.url })),
            hoverImage: p.hoverImage ?? null,
            options: Array.isArray(options) ? options.map((o) => ({
              label: o.label,
              type: o.type,
              values: typeof (o as unknown as { values: string }).values === 'string'
                ? String((o as unknown as { values: string }).values).split(',').map((s) => s.trim()).filter(Boolean)
                : (o.values as unknown as string[]),
            })) : [],
            bundles: p.bundles,
            upsellIds: p.upsellIds,
            metaTitle: p.metaTitle ?? '',
            metaDescription: p.metaDescription ?? '',
            focusKeyword: p.focusKeyword ?? '',
            imageAlt: p.images[0]?.alt ?? '',
          });
        })
        .catch(() => alert('Erreur de chargement du produit'))
        .finally(() => setLoading(false));
    } else {
      setForm(EMPTY);
    }
    setTab('description');
  }, [open, productId, categories.length]);

  function up<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    if (!form.name.trim()) { alert('Nom obligatoire'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        slug: form.slug || undefined,
        sku: form.sku || undefined,
        status: form.status,
        metaTitle: form.metaTitle || null,
        metaDescription: form.metaDescription || null,
        focusKeyword: form.focusKeyword || null,
        imageAlt: form.imageAlt || null,
        description: form.description,
        regularPrice: form.regularPrice,
        salePrice: form.salePrice || null,
        cost: form.cost,
        deliveryPrice: form.deliveryPrice,
        deliveryCost: form.deliveryCost,
        manageStock: form.manageStock,
        stockQuantity: form.manageStock ? form.stockQuantity : null,
        categoryIds: form.categoryIds,
        imageIds: form.images.map((i) => i.id),
        upsellIds: form.upsellIds,
        bundles: form.bundles,
        hoverImage: form.hoverImage,
        options: form.options.map((o) => ({ label: o.label, type: o.type, values: o.values.join(',') })),
      };
      const url = isEdit ? `/api/admin/products/${productId}` : '/api/admin/products';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erreur');
      const product = await res.json();
      onSaved?.(product);
      onClose();
    } catch (e) {
      alert(`Échec: ${e instanceof Error ? e.message : 'inconnu'}`);
    } finally {
      setSaving(false);
    }
  }

  async function duplicate() {
    if (!productId) return;
    const res = await fetch(`/api/admin/products/${productId}`);
    if (!res.ok) return alert('Erreur');
    const original: Product = await res.json();
    const payload = {
      name: `${original.name} (copie)`,
      status: 'draft' as const,
      description: original.description,
      regularPrice: original.regularPrice,
      salePrice: original.salePrice ?? null,
      categoryIds: original.categoryIds,
      imageIds: original.images.map((i) => i.id),
      bundles: original.bundles,
    };
    const create = await fetch('/api/admin/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!create.ok) return alert('Erreur de duplication');
    const p = await create.json();
    onSaved?.(p);
    onClose();
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? `Modifier ${form.name}`.trim() : 'Ajouter un produit'}
      actions={
        <>
          <select
            value={form.status}
            onChange={(e) => up('status', e.target.value as FormState['status'])}
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 focus:outline-none"
          >
            <option value="published">Affiché</option>
            <option value="draft">Brouillon</option>
            <option value="private">Privé</option>
          </select>
          {isEdit && (
            <button type="button" onClick={duplicate} className="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-bold text-ink-900 hover:bg-ink-100">
              <Copy size={14} /> Dupliquer
            </button>
          )}
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white shadow-soft hover:bg-brand-600 disabled:opacity-50">
            <Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      {loading ? <p className="p-10 text-center text-ink-700">Chargement…</p> : (
        <div className="space-y-5">
          {/* Détails */}
          <section className="rounded-2xl border border-ink-200 bg-white">
            <header className="border-b border-ink-200 px-5 py-3">
              <h3 className="text-sm font-black uppercase tracking-wide text-ink-900">Détails</h3>
            </header>
            <div className="p-5">
              <ImageGallery
                images={form.images}
                onReorder={(next) => up('images', next)}
                onRemove={(id) => up('images', form.images.filter((i) => i.id !== id))}
                onAdd={(img) => up('images', [...form.images, img])}
              />
              <div className="mt-4 flex items-center gap-4">
                <div className="relative">
                  {form.hoverImage ? (
                    <div className="group relative h-24 w-24 overflow-hidden rounded-xl border border-ink-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={form.hoverImage} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => up('hoverImage', null)}
                        className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-md bg-white/90 text-red-500 opacity-0 transition group-hover:opacity-100"
                      ><X size={10} /></button>
                    </div>
                  ) : (
                    <ImageUploader
                      onUploaded={(img) => up('hoverImage', img.url)}
                      className="grid h-24 w-24 place-items-center rounded-xl border-2 border-dashed border-ink-200 bg-ink-100 text-xs font-bold text-ink-700 transition hover:border-brand-300 hover:bg-ink-200"
                    >
                      <span className="flex flex-col items-center gap-1">
                        <Upload size={16} className="text-brand-500" />
                        <span>Image survol</span>
                      </span>
                    </ImageUploader>
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-ink-900">Image de survol</p>
                  <p className="text-xs text-ink-700">Photo secondaire qui apparaît au survol de la carte produit.</p>
                </div>
              </div>

              <p className="mb-5 mt-2 text-xs text-ink-700">
                Glissez-déposez pour réordonner. La première image est l&apos;image principale du produit.
              </p>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Nom du produit" className="md:col-span-1"><input className="input" value={form.name} onChange={(e) => up('name', e.target.value)} /></Field>
                <Field label="SKU"><input className="input" value={form.sku} onChange={(e) => up('sku', e.target.value)} /></Field>
                <Field label="Catégories">
                  <MultiCheckSelect
                    items={categories.map((c) => ({ id: c.id, name: c.name }))}
                    selected={form.categoryIds}
                    onChange={(ids) => up('categoryIds', ids)}
                    placeholder="Pas de catégories"
                  />
                </Field>
              </div>

              <label className="mt-5 flex cursor-pointer items-center gap-3 text-sm font-bold">
                <span className={`relative inline-block h-6 w-11 rounded-full transition ${form.manageStock ? 'bg-brand-500' : 'bg-ink-200'}`}>
                  <input
                    type="checkbox"
                    checked={form.manageStock}
                    onChange={(e) => up('manageStock', e.target.checked)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                  <span className={`absolute top-0.5 grid h-5 w-5 place-items-center rounded-full bg-white shadow transition ${form.manageStock ? 'left-5' : 'left-0.5'}`} />
                </span>
                Suivre le stock
              </label>
              {form.manageStock && (
                <Field label="Quantité en stock" className="mt-3 max-w-xs">
                  <NumberField className="input" min={0} value={form.stockQuantity} onChange={(v) => up('stockQuantity', v)} />
                </Field>
              )}
            </div>
          </section>

          {/* Détails du prix */}
          <section className="rounded-2xl border border-ink-200 bg-white">
            <header className="flex items-center justify-between border-b border-ink-200 px-5 py-3">
              <h3 className="text-sm font-black uppercase tracking-wide text-ink-900">Détails du prix</h3>
              <button type="button" className="text-xs font-bold text-brand-500 hover:underline">Appliquer à toutes les options</button>
            </header>
            <div className="grid gap-4 p-5 md:grid-cols-3">
              <Field label="Prix avant remise"><NumberField className="input" step={0.01} decimals={2} value={form.regularPrice} onChange={(v) => up('regularPrice', v)} /></Field>
              <Field label="Prix"><NumberField className="input" step={0.01} decimals={2} value={form.salePrice} onChange={(v) => up('salePrice', v)} /></Field>
              <Field label="Coût"><NumberField className="input" step={0.01} decimals={2} value={form.cost} onChange={(v) => up('cost', v)} /></Field>
              <Field label="Frais de livraison"><NumberField className="input" step={0.01} decimals={2} value={form.deliveryPrice} onChange={(v) => up('deliveryPrice', v)} /></Field>
              <Field label="Coût de livraison"><NumberField className="input" step={0.01} decimals={2} value={form.deliveryCost} onChange={(v) => up('deliveryCost', v)} /></Field>
            </div>
          </section>

          {/* Tabs */}
          <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
            <nav className="flex flex-wrap gap-2 bg-brand-500 p-3">
              {([
                ['description', 'Description'],
                ['options', 'Options'],
                ['bundles', 'Bundles'],
                ['related', 'Produits associés'],
                ['seo', 'SEO'],
                ['reviews', 'Avis'],
              ] as [Tab, string][]).map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition ${tab === k ? 'bg-white text-brand-500' : 'bg-white/15 text-white hover:bg-white/25'}`}
                >
                  {lbl}
                </button>
              ))}
            </nav>

            <div className="p-5">
              {tab === 'description' && (
                <textarea rows={8} className="input" value={form.description} onChange={(e) => up('description', e.target.value)} placeholder="Description" />
              )}
              {tab === 'options' && (
                <OptionsTab options={form.options} onChange={(opts) => up('options', opts)} />
              )}
              {tab === 'bundles' && (
                <BundlesTab bundles={form.bundles} onChange={(b) => up('bundles', b)} />
              )}
              {tab === 'related' && (
                <RelatedTab selected={form.upsellIds} onChange={(ids) => up('upsellIds', ids)} />
              )}
              {tab === 'seo' && (
                <SeoTab form={form} up={up} />
              )}
              {tab === 'reviews' && (
                <p className="text-sm text-ink-700">Les avis client s&apos;afficheront ici une fois disponibles depuis l&apos;API.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </Drawer>
  );
}

function RelatedTab({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const [items, setItems] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/admin/products-picker').then((r) => r.json()).then((d: { id: string; name: string }[]) => {
      setItems(d.map((p) => ({ id: p.id, name: p.name })));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  if (loading) return <p className="text-sm text-ink-700">Chargement…</p>;
  return (
    <Field label="Produits associés">
      <MultiCheckSelect items={items} selected={selected} onChange={onChange} placeholder="Aucun produit associé" />
    </Field>
  );
}

function OptionsTab({ options, onChange }: { options: FormState['options']; onChange: (v: FormState['options']) => void }) {
  function update(i: number, patch: Partial<FormState['options'][number]>) {
    onChange(options.map((o, idx) => idx === i ? { ...o, ...patch } : o));
  }
  function remove(i: number) { onChange(options.filter((_, idx) => idx !== i)); }
  function add() { onChange([...options, { label: '', type: 'text', values: [] }]); }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={add} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white hover:bg-brand-600">
          <Plus size={14} /> Ajouter une option
        </button>
      </div>

      {options.map((o, i) => (
        <div key={i} className="grid gap-3 rounded-xl border border-ink-200 p-4 md:grid-cols-[1fr_1fr_2fr_auto]">
          <Field label="Nom de l'option"><input className="input" value={o.label} onChange={(e) => update(i, { label: e.target.value })} /></Field>
          <Field label="Type">
            <select className="input" value={o.type} onChange={(e) => update(i, { type: e.target.value as 'text' | 'select' | 'radio' })}>
              <option value="text">Texte</option>
              <option value="select">Select</option>
              <option value="radio">Radio</option>
            </select>
          </Field>
          <Field label="Valeurs">
            <ChipsInput values={o.values} onChange={(values) => update(i, { values })} />
          </Field>
          <button type="button" onClick={() => remove(i)} className="self-end rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>
        </div>
      ))}

      {options.length === 0 && <p className="text-sm text-ink-700">Aucune option. Cliquez sur « Ajouter une option ».</p>}
    </div>
  );
}

function ChipsInput({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState('');
  function commit() {
    const v = text.trim();
    if (!v) return;
    if (values.includes(v)) { setText(''); return; }
    onChange([...values, v]);
    setText('');
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2">
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-md bg-brand-100 px-2 py-1 text-xs font-bold text-brand-700">
          {v}
          <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="text-brand-700/70 hover:text-red-500"><X size={12} /></button>
        </span>
      ))}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); } }}
        onBlur={commit}
        className="min-w-[120px] flex-1 bg-transparent text-sm outline-none"
        placeholder="Écrivez ici"
      />
    </div>
  );
}

function BundlesTab({ bundles, onChange }: { bundles: ProductBundle[]; onChange: (v: ProductBundle[]) => void }) {
  function update(i: number, patch: Partial<ProductBundle>) {
    onChange(bundles.map((b, idx) => idx === i ? { ...b, ...patch } : b));
  }
  function remove(i: number) { onChange(bundles.filter((_, idx) => idx !== i)); }
  function add() {
    onChange([...bundles, {
      id: String(Date.now()),
      name: `Bundle ${bundles.length + 1}`,
      label: '',
      regularPrice: 0, price: 0, deliveryPrice: 0, quantity: 1,
      badgeColor: 'red', isDefault: false,
    }]);
  }
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={add} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white hover:bg-brand-600">
          <Plus size={14} /> Ajouter un bundle
        </button>
      </div>
      {bundles.map((b, i) => (
        <article key={b.id} className="rounded-xl border border-ink-200 p-4">
          <header className="mb-4 flex items-center justify-between">
            <h4 className="text-sm font-black text-ink-900">Bundle {i + 1}</h4>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs font-bold">
                <input type="checkbox" checked={b.isDefault} onChange={(e) => update(i, { isDefault: e.target.checked })} className="h-4 w-4 accent-brand-500" />
                Par défaut
              </label>
              <button type="button" onClick={() => remove(i)} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>
            </div>
          </header>

          <div className="grid gap-3 md:grid-cols-[1.4fr_140px]">
            <div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Nom"><input className="input" value={b.name} onChange={(e) => update(i, { name: e.target.value })} /></Field>
                <Field label="Libellé"><input className="input" value={b.label ?? ''} onChange={(e) => update(i, { label: e.target.value })} /></Field>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <Field label="Prix avant remise"><NumberField className="input" step={0.01} decimals={2} value={b.regularPrice} onChange={(v) => update(i, { regularPrice: v })} /></Field>
                <Field label="Prix"><NumberField className="input" step={0.01} decimals={2} value={b.price} onChange={(v) => update(i, { price: v })} /></Field>
                <Field label="Frais de livraison"><NumberField className="input" step={0.01} decimals={2} value={b.deliveryPrice} onChange={(v) => update(i, { deliveryPrice: v })} /></Field>
                <Field label="Quantité"><NumberField className="input" min={1} blankOnZero={false} value={b.quantity} onChange={(v) => update(i, { quantity: Math.max(1, v) })} /></Field>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                <span className="font-bold text-ink-700">Couleur de la marque de remise :</span>
                {(['red', 'green', 'blue', 'purple'] as const).map((c) => (
                  <label key={c} className="inline-flex cursor-pointer items-center gap-1.5">
                    <input
                      type="radio"
                      name={`badge-${b.id}`}
                      checked={b.badgeColor === c}
                      onChange={() => update(i, { badgeColor: c })}
                    />
                    <span className={`rounded px-2 py-0.5 text-[11px] font-black text-white ${c === 'red' ? 'bg-red-500' : c === 'green' ? 'bg-emerald-500' : c === 'blue' ? 'bg-blue-500' : 'bg-brand-500'}`}>
                      -{Math.max(0, Math.round(((b.regularPrice - b.price) / Math.max(1, b.regularPrice)) * 100))}% OFF
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-bold uppercase text-ink-700">Image</span>
              <div className="relative">
                {b.imageUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={b.imageUrl} alt="" className="h-32 w-full rounded-xl object-cover" />
                )}
                <ImageUploader
                  onUploaded={(img) => update(i, { imageUrl: img.url })}
                  className={`${b.imageUrl ? 'absolute inset-0 bg-black/35 text-white opacity-0 transition hover:opacity-100 rounded-xl flex items-center justify-center' : 'flex h-32 w-full items-center justify-center rounded-xl border-2 border-dashed border-ink-200 bg-ink-100 text-xs font-bold text-ink-700 transition hover:border-brand-300 hover:bg-ink-200'}`}
                >
                  {b.imageUrl ? (
                    <span className="flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-bold text-ink-900">
                      <Upload size={14} className="text-brand-500" /> Remplacer
                    </span>
                  ) : (
                    <span className="flex flex-col items-center gap-1">
                      <Upload size={18} className="text-brand-500" />
                      <span>400 × 400</span>
                    </span>
                  )}
                </ImageUploader>
              </div>
            </div>
          </div>
        </article>
      ))}
      {bundles.length === 0 && <p className="text-sm text-ink-700">Aucun bundle. Cliquez sur « Ajouter un bundle ».</p>}
    </div>
  );
}

/**
 * Drag-and-drop reorderable image gallery (HTML5 DnD, no extra deps).
 * Each tile is draggable. Drop the dragged tile onto another to swap places.
 * The "+ upload" tile is appended at the end and not reorderable.
 */
function ImageGallery({
  images, onReorder, onRemove, onAdd,
}: {
  images: { id: string; url: string }[];
  onReorder: (next: { id: string; url: string }[]) => void;
  onRemove: (id: string) => void;
  onAdd: (img: { id: string; url: string }) => void;
}) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  function move(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    const next = images.slice();
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onReorder(next);
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
      {images.map((img, i) => {
        const isDragged = dragFrom === i;
        const isTarget = dragOver === i && dragFrom !== null && dragFrom !== i;
        const isMain = i === 0;
        return (
          <div
            key={img.id}
            draggable
            onDragStart={(e) => {
              setDragFrom(i);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', String(i));
            }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(i); }}
            onDragLeave={() => setDragOver((cur) => (cur === i ? null : cur))}
            onDrop={(e) => {
              e.preventDefault();
              const from = dragFrom ?? Number(e.dataTransfer.getData('text/plain'));
              if (Number.isFinite(from)) move(from as number, i);
              setDragFrom(null); setDragOver(null);
            }}
            onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
            className={`group relative aspect-square cursor-grab overflow-hidden rounded-xl border bg-ink-100 transition active:cursor-grabbing ${
              isDragged ? 'border-brand-500 opacity-40' :
              isTarget ? 'border-brand-500 ring-2 ring-brand-300 scale-[1.04]' :
              'border-ink-200'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="" draggable={false} className="pointer-events-none h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(img.id)}
              className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-md bg-white/90 text-red-500 opacity-0 transition group-hover:opacity-100"
              aria-label="Supprimer"
            >
              <X size={12} />
            </button>
            <span
              className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-md bg-white/95 text-ink-700"
              aria-hidden
            >
              <GripVertical size={12} />
            </span>
            {isMain && (
              <span className="absolute bottom-1 left-1 rounded bg-brand-500 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                Principale
              </span>
            )}
          </div>
        );
      })}
      <ImageUploader
        multiple
        onUploaded={(img) => onAdd(img)}
      />
    </div>
  );
}

const STATUS_RING: Record<SeoStatus, string> = {
  poor: 'text-red-600 bg-red-50 ring-red-200',
  fair: 'text-amber-600 bg-amber-50 ring-amber-200',
  good: 'text-blue-600 bg-blue-50 ring-blue-200',
  excellent: 'text-emerald-600 bg-emerald-50 ring-emerald-200',
};
const STATUS_BAR: Record<SeoStatus, string> = {
  poor: 'bg-red-500', fair: 'bg-amber-500', good: 'bg-blue-500', excellent: 'bg-emerald-500',
};

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function SeoTab({ form, up }: { form: FormState; up: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  const result = scoreProductSeo({
    name: form.name,
    slug: form.slug,
    metaTitle: form.metaTitle,
    metaDescription: form.metaDescription,
    focusKeyword: form.focusKeyword,
    description: form.description,
    hasImage: form.images.length > 0,
    imageAlt: form.imageAlt,
  });
  const status = statusFromScore(result.score);
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://shiraly.tn').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const previewSlug = form.slug || slugify(form.name) || 'produit';

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Editor */}
      <div className="space-y-4">
        <Field label="Mot-clé cible">
          <input className="input" value={form.focusKeyword} onChange={(e) => up('focusKeyword', e.target.value)} placeholder="ex: veste en cuir homme" />
        </Field>
        <Field label="Méta-titre (SEO)">
          <input className="input" value={form.metaTitle} onChange={(e) => up('metaTitle', e.target.value)} placeholder={form.name || 'Titre affiché dans Google'} maxLength={70} />
          <span className="mt-1 block text-[11px] text-ink-700">{form.metaTitle.length}/60 caractères</span>
        </Field>
        <Field label="Méta-description">
          <textarea rows={3} className="input" value={form.metaDescription} onChange={(e) => up('metaDescription', e.target.value)} placeholder="Description affichée dans les résultats de recherche…" maxLength={180} />
          <span className="mt-1 block text-[11px] text-ink-700">{form.metaDescription.length}/160 caractères</span>
        </Field>
        <Field label="Slug (URL)">
          <div className="flex items-center gap-2">
            <input className="input" value={form.slug} onChange={(e) => up('slug', slugify(e.target.value))} placeholder="slug-du-produit" />
            <button type="button" onClick={() => up('slug', slugify(form.name))} className="shrink-0 rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-bold text-ink-900 hover:bg-ink-100">Générer</button>
          </div>
        </Field>
        <Field label="Texte alternatif (image principale)">
          <input className="input" value={form.imageAlt} onChange={(e) => up('imageAlt', e.target.value)} placeholder="Décrivez l'image principale" />
        </Field>
      </div>

      {/* Score + preview */}
      <div className="space-y-4">
        <div className={`rounded-2xl p-5 ring-1 ${STATUS_RING[status]}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide opacity-80">Score SEO</p>
              <p className="text-3xl font-black">{result.score}/100</p>
            </div>
            <span className="rounded-full bg-white/70 px-3 py-1 text-sm font-black">{STATUS_LABEL[status]}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/60">
            <div className={`h-full rounded-full ${STATUS_BAR[status]} transition-all`} style={{ width: `${result.score}%` }} />
          </div>
        </div>

        {/* Snippet preview */}
        <div className="rounded-2xl border border-ink-200 bg-white p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-700">Aperçu Google</p>
          <p className="truncate text-sm text-emerald-700">{base}/produit/{previewSlug}</p>
          <p className="truncate text-lg font-medium text-blue-800">{form.metaTitle || form.name || 'Titre du produit'}</p>
          <p className="line-clamp-2 text-sm text-ink-700">{form.metaDescription || 'Ajoutez une méta-description pour contrôler ce texte.'}</p>
        </div>

        {/* Checklist */}
        <ul className="space-y-1.5">
          {result.checks.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-sm">
              <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-black text-white ${c.passed ? 'bg-emerald-500' : 'bg-ink-300'}`}>
                {c.passed ? '✓' : '!'}
              </span>
              <span className={c.passed ? 'text-ink-900' : 'text-ink-700'}>
                {c.label}
                {!c.passed && <span className="block text-[11px] text-ink-500">{c.hint}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-700">{label}</span>
      {children}
    </label>
  );
}
