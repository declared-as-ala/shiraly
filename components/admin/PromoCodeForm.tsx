'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, ArrowLeft, Sparkles } from 'lucide-react';
import { useToast } from './Toast';
import { PageHeader, Field } from './ui';
import { formatPrice } from '@/lib/site-config';
import type { PromoCodeData, PromoCodeCreateInput, PromoType, PromoApplicableTo } from '@/types';

type Props = {
  promo?: PromoCodeData | null;
};

const randomCodes = [
  'WELCOME10', 'SHIRALY20', 'SUMMER15', 'VIP25', 'LUXE30',
  'PREMIUM', 'EXCLUSIF', 'COPIN10', 'FIDELITE', 'NOUVEAU',
];

function generateCode(): string {
  const adj = ['LUXE', 'VIP', 'OR', 'PREMIUM', 'ELITE', 'ROYAL', 'GOLD', 'STAR'];
  const num = Math.floor(Math.random() * 90 + 10);
  return `${adj[Math.floor(Math.random() * adj.length)]}${num}`;
}

export default function PromoCodeForm({ promo }: Props) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = !!promo;

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  const [form, setForm] = useState<{
    code: string;
    description: string;
    type: PromoType;
    value: number;
    minimumOrderAmount: number;
    maximumDiscountAmount: number;
    startsAt: string;
    expiresAt: string;
    usageLimit: number;
    active: boolean;
    applicableTo: PromoApplicableTo;
    selectedProductIds: string[];
    selectedCategoryIds: string[];
  }>({
    code: promo?.code ?? '',
    description: promo?.description ?? '',
    type: promo?.type ?? 'PERCENTAGE',
    value: promo?.value ?? 0,
    minimumOrderAmount: promo?.minimumOrderAmount ?? 0,
    maximumDiscountAmount: promo?.maximumDiscountAmount ?? 0,
    startsAt: promo?.startsAt ? promo.startsAt.slice(0, 16) : '',
    expiresAt: promo?.expiresAt ? promo.expiresAt.slice(0, 16) : '',
    usageLimit: promo?.usageLimit ?? 0,
    active: promo?.active ?? true,
    applicableTo: promo?.applicableTo ?? 'ALL_PRODUCTS',
    selectedProductIds: promo?.selectedProductIds ?? [],
    selectedCategoryIds: promo?.selectedCategoryIds ?? [],
  });

  useEffect(() => {
    fetch('/api/admin/products-picker').then(async (r) => { if (r.ok) { const d = await r.json(); setProducts(d); } }).catch(() => {});
    fetch('/api/admin/categories').then(async (r) => { if (r.ok) { const d = await r.json(); setCategories(d); } }).catch(() => {});
  }, []);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  }

  function generateRandom() {
    set('code', generateCode());
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.code.trim()) errs.code = 'Le code est requis.';
    if (!form.type) errs.type = 'Le type est requis.';
    if (form.value <= 0) errs.value = 'La valeur doit être supérieure à 0.';
    if (form.type === 'PERCENTAGE' && form.value > 100) errs.value = 'Le pourcentage ne peut pas dépasser 100.';
    if (form.applicableTo === 'SPECIFIC_PRODUCTS' && form.selectedProductIds.length === 0) {
      errs.applicableTo = 'Sélectionnez au moins un produit.';
    }
    if (form.applicableTo === 'SPECIFIC_CATEGORIES' && form.selectedCategoryIds.length === 0) {
      errs.applicableTo = 'Sélectionnez au moins une catégorie.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: PromoCodeCreateInput = {
        code: form.code.toUpperCase().trim(),
        description: form.description || undefined,
        type: form.type,
        value: form.value,
        minimumOrderAmount: form.minimumOrderAmount > 0 ? form.minimumOrderAmount : undefined,
        maximumDiscountAmount: form.maximumDiscountAmount > 0 ? form.maximumDiscountAmount : undefined,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
        usageLimit: form.usageLimit > 0 ? form.usageLimit : undefined,
        active: form.active,
        applicableTo: form.applicableTo,
        selectedProductIds: form.selectedProductIds,
        selectedCategoryIds: form.selectedCategoryIds,
      };

      const url = isEdit
        ? `/api/admin/promo-codes/${promo!.id}`
        : '/api/admin/promo-codes';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erreur d\'enregistrement');
        return;
      }
      toast.success(isEdit ? 'Code promo mis à jour' : 'Code promo créé');
      router.push('/admin/promo-codes');
      router.refresh();
    } catch {
      toast.error('Erreur d\'enregistrement');
    } finally {
      setSaving(false);
    }
  }

  const toggleProduct = (id: string) => {
    set('selectedProductIds', form.selectedProductIds.includes(id)
      ? form.selectedProductIds.filter((x) => x !== id)
      : [...form.selectedProductIds, id]);
  };
  const toggleCategory = (id: string) => {
    set('selectedCategoryIds', form.selectedCategoryIds.includes(id)
      ? form.selectedCategoryIds.filter((x) => x !== id)
      : [...form.selectedCategoryIds, id]);
  };

  return (
    <div className="p-8">
      <PageHeader
        title={isEdit ? `Modifier ${promo!.code}` : 'Nouveau code promo'}
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Codes promo', href: '/admin/promo-codes' },
          { label: isEdit ? promo!.code : 'Nouveau' },
        ]}
        actions={
          <button onClick={() => router.push('/admin/promo-codes')} className="btn-ghost inline-flex items-center gap-2">
            <ArrowLeft size={16} /> Retour
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card space-y-6 p-6 lg:col-span-2">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Code promo *" htmlFor="code" error={errors.code}>
              <div className="flex gap-2">
                <input
                  id="code"
                  className="input flex-1 uppercase"
                  value={form.code}
                  onChange={(e) => set('code', e.target.value)}
                  placeholder="EXEMPLE10"
                  disabled={isEdit}
                />
                {!isEdit && (
                  <button type="button" onClick={generateRandom} className="btn-ghost shrink-0" title="Générer un code aléatoire">
                    <Sparkles size={16} />
                  </button>
                )}
              </div>
            </Field>

            <Field label="Description" htmlFor="desc">
              <input
                id="desc"
                className="input"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Description interne (optionnelle)"
              />
            </Field>

            <Field label="Type de remise *" htmlFor="type" error={errors.type}>
              <select id="type" className="input" value={form.type} onChange={(e) => set('type', e.target.value as PromoType)}>
                <option value="PERCENTAGE">Pourcentage (%)</option>
                <option value="FIXED_AMOUNT">Montant fixe (DT)</option>
              </select>
            </Field>

            <Field label="Valeur *" htmlFor="value" error={errors.value}>
              <input
                id="value"
                type="number"
                className="input"
                value={form.value || ''}
                onChange={(e) => set('value', Math.max(0, Number(e.target.value)))}
                min={0}
                step={form.type === 'PERCENTAGE' ? 1 : 5}
              />
            </Field>

            <Field label="Montant minimum de commande" htmlFor="minOrder" hint="Laisser à 0 pour aucun minimum">
              <input
                id="minOrder"
                type="number"
                className="input"
                value={form.minimumOrderAmount || ''}
                onChange={(e) => set('minimumOrderAmount', Math.max(0, Number(e.target.value)))}
                min={0}
                step={5}
              />
            </Field>

            <Field label="Remise maximale" htmlFor="maxDiscount" hint="Utile pour les pourcentages. 0 = illimité">
              <input
                id="maxDiscount"
                type="number"
                className="input"
                value={form.maximumDiscountAmount || ''}
                onChange={(e) => set('maximumDiscountAmount', Math.max(0, Number(e.target.value)))}
                min={0}
                step={5}
              />
            </Field>

            <Field label="Date de début" htmlFor="startsAt" hint="Optionnelle">
              <input
                id="startsAt"
                type="datetime-local"
                className="input"
                value={form.startsAt}
                onChange={(e) => set('startsAt', e.target.value)}
              />
            </Field>

            <Field label="Date d'expiration" htmlFor="expiresAt" hint="Optionnelle">
              <input
                id="expiresAt"
                type="datetime-local"
                className="input"
                value={form.expiresAt}
                onChange={(e) => set('expiresAt', e.target.value)}
              />
            </Field>

            <Field label="Limite d'utilisations" htmlFor="usageLimit" hint="0 = illimité">
              <input
                id="usageLimit"
                type="number"
                className="input"
                value={form.usageLimit || ''}
                onChange={(e) => set('usageLimit', Math.max(0, Number(e.target.value)))}
                min={0}
              />
            </Field>

            <Field label="Actif" htmlFor="active">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  id="active"
                  type="checkbox"
                  className="h-5 w-5 accent-brand-500"
                  checked={form.active}
                  onChange={(e) => set('active', e.target.checked)}
                />
                <span className="text-sm text-ink-700">{form.active ? 'Code actif' : 'Code désactivé'}</span>
              </label>
            </Field>
          </div>
        </div>

        <div className="card space-y-6 p-6 lg:col-span-2">
          <h3 className="font-bold text-ink-900">Appliquer à</h3>
          <Field label="Type d'application" error={errors.applicableTo}>
            <select
              className="input"
              value={form.applicableTo}
              onChange={(e) => set('applicableTo', e.target.value as PromoApplicableTo)}
            >
              <option value="ALL_PRODUCTS">Tous les produits</option>
              <option value="SPECIFIC_PRODUCTS">Produits spécifiques</option>
              <option value="SPECIFIC_CATEGORIES">Catégories spécifiques</option>
            </select>
          </Field>

          {form.applicableTo === 'SPECIFIC_PRODUCTS' && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-700">Sélectionner les produits</p>
              <div className="max-h-60 space-y-1 overflow-y-auto rounded-xl border border-ink-200 p-2">
                {products.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-sand-100">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-500"
                      checked={form.selectedProductIds.includes(p.id)}
                      onChange={() => toggleProduct(p.id)}
                    />
                    <span className="text-sm">{p.name}</span>
                  </label>
                ))}
                {products.length === 0 && <p className="p-3 text-xs text-ink-500">Aucun produit trouvé.</p>}
              </div>
            </div>
          )}

          {form.applicableTo === 'SPECIFIC_CATEGORIES' && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-700">Sélectionner les catégories</p>
              <div className="max-h-60 space-y-1 overflow-y-auto rounded-xl border border-ink-200 p-2">
                {categories.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-sand-100">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-500"
                      checked={form.selectedCategoryIds.includes(c.id)}
                      onChange={() => toggleCategory(c.id)}
                    />
                    <span className="text-sm">{c.name}</span>
                  </label>
                ))}
                {categories.length === 0 && <p className="p-3 text-xs text-ink-500">Aucune catégorie trouvée.</p>}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 lg:col-span-2">
          <button onClick={() => router.push('/admin/promo-codes')} className="btn-ghost">
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary inline-flex items-center gap-2 disabled:opacity-50">
            <Save size={16} /> {saving ? 'Enregistrement…' : (isEdit ? 'Mettre à jour' : 'Créer le code')}
          </button>
        </div>
      </div>
    </div>
  );
}
