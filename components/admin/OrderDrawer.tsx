'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Drawer from './Drawer';
import NumberField from './NumberField';
import BestDeliveryPanel from './BestDeliveryPanel';
import { Save, Trash2, Plus, History } from 'lucide-react';
import { SITE, formatPrice } from '@/lib/site-config';
import type { OrderResponse, OrderStatus } from '@/types';

type ProductPickerItem = { id: string; name: string; price: number; image?: string };
type LineDraft = {
  productId: string;
  name: string;
  image?: string;
  qty: number;
  unitPrice: number;
  variation: Record<string, string>;     // per-slot variation (e.g. {size: 'm', color: 'noir'})
  bundleName?: string;                   // groups slots together under one bundle row
  slotIndex?: number;                    // 1-based slot index within the bundle
};

type ProductInfo = {
  options: { name: string; values: string[] }[];   // {name:'size', values:['s','m','l',...]}
  bundles: { id: string; name: string; quantity: number; price: number }[];
};

type AssignmentEntry = {
  employeeId: string | null;
  employeeName?: string;
  at: string;
  by?: 'auto' | 'admin' | 'employee';
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'En attente',
  'en-attente': 'En attente',
  processing: 'En traitement',
  confirme: 'Confirmée',
  'on-hold': 'En pause',
  completed: 'Terminée',
  cancelled: 'Annulée',
  annule: 'Annulée',
  refunded: 'Remboursée',
  failed: 'Échouée',
  tentative: 'Tentative',
  'auto-draft': 'Brouillon',
  'checkout-draft': 'Abandonnée',
};
function labelFor(slug: string): string {
  return STATUS_LABEL[slug] ?? slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function numberFromMeta(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function money(value: number): number {
  return Math.round(Math.max(0, value) * 100) / 100;
}



/**
 * Parse a server-supplied order line (with chip-style attributes set by
 * the storefront) into the editable shape used by the drawer.
 *
 * Attributes can look like:
 *   [{ key: 'Offre', value: '2 Labsa : 80 D' }, { key: 'Item 1', value: 'size: m · color: noir' }]
 * For non-bundle lines they look like:
 *   [{ key: 'size', value: 'm' }, { key: 'color', value: 'noir' }]
 */
function parseLine(i: {
  productId: string; name: string; quantity: number; price: number;
  imageUrl?: string; attributes?: { key: string; value: string }[];
}): LineDraft {
  const attrs = i.attributes ?? [];
  const offer = attrs.find((a) => /^offre$/i.test(a.key));
  const itemAttr = attrs.find((a) => /^item\s*\d+/i.test(a.key));
  const variation: Record<string, string> = {};
  let slotIndex: number | undefined;

  if (itemAttr) {
    // Bundle slot. Parse "size: m · color: noir" into structured map.
    const m = itemAttr.key.match(/(\d+)/);
    slotIndex = m ? Number(m[1]) : undefined;
    for (const part of itemAttr.value.split(/[·;,]/)) {
      const [k, v] = part.split(':').map((s) => s?.trim());
      if (k && v) variation[k] = v;
    }
  } else {
    for (const a of attrs) {
      if (/^offre$/i.test(a.key)) continue;
      if (a.key && a.value && a.value !== '—') variation[a.key] = a.value;
    }
  }

  return {
    productId: i.productId,
    name: i.name,
    image: i.imageUrl,
    qty: i.quantity,
    unitPrice: i.price,
    variation,
    bundleName: offer?.value,
    slotIndex,
  };
}

type Props = {
  open: boolean;
  onClose: () => void;
  orderId?: string | null;
  onSaved?: (order: OrderResponse) => void;
  /** API base — pass '/api/employee' to scope to the current employee. Default: '/api/admin'. */
  apiBase?: '/api/admin' | '/api/employee';
};

export default function OrderDrawer({ open, onClose, orderId, onSaved, apiBase = '/api/admin' }: Props) {
  const isEdit = Boolean(orderId);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<ProductPickerItem[]>([]);
  const [statusList, setStatusList] = useState<string[]>([]);
  const [originalStatus, setOriginalStatus] = useState<string>('');
  const [status, setStatus] = useState<OrderStatus>('');
  const [attempts, setAttempts] = useState<number>(1);
  const [assignmentHistory, setAssignmentHistory] = useState<AssignmentEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [employeeNames, setEmployeeNames] = useState<Record<string, string>>({});
  const [exchange, setExchange] = useState(false);
  const [shipping, setShipping] = useState(8);
  const [deliveryCompany, setDeliveryCompany] = useState('');
  const [privateNote, setPrivateNote] = useState('');
  const [customer, setCustomer] = useState({ firstName: '', phone: '', city: '', address: '', phone2: '', email: '', note: '' });
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [productInfo, setProductInfo] = useState<Record<string, ProductInfo>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);
  const saveInFlightRef = useRef(false);

  async function ensureProductInfo(pid: string): Promise<ProductInfo | null> {
    if (productInfo[pid]) {
      const info = productInfo[pid];
      setLines((prev) => prev.map((l) => {
        if (l.productId !== pid) return l;
        const normalizedVariation: Record<string, string> = {};
        for (const [k, v] of Object.entries(l.variation)) {
          const matchedOpt = info.options.find((opt) => opt.name.toLowerCase().trim() === k.toLowerCase().trim());
          if (matchedOpt) {
            normalizedVariation[matchedOpt.name] = v;
          } else {
            normalizedVariation[k] = v;
          }
        }
        return { ...l, variation: normalizedVariation };
      }));
      return info;
    }
    try {
      const res = await fetch(`${apiBase}/products/${pid}`);
      if (!res.ok) return null;
      const p = await res.json();
      const opts = (p.attributes ?? []).map((a: { name: string; options: string[] }) => ({
        name: a.name,
        values: a.options ?? [],
      }));
      const info: ProductInfo = {
        options: opts,
        bundles: (p.bundles ?? []).map((b: { id: string; name: string; quantity: number; price: number }) => ({
          id: b.id, name: b.name, quantity: b.quantity, price: b.price,
        })),
      };
      setProductInfo((prev) => ({ ...prev, [pid]: info }));

      setLines((prev) => prev.map((l) => {
        if (l.productId !== pid) return l;
        const normalizedVariation: Record<string, string> = {};
        for (const [k, v] of Object.entries(l.variation)) {
          const matchedOpt = opts.find((opt: { name: string; values: string[] }) => opt.name.toLowerCase().trim() === k.toLowerCase().trim());
          if (matchedOpt) {
            normalizedVariation[matchedOpt.name] = v;
          } else {
            normalizedVariation[k] = v;
          }
        }
        return { ...l, variation: normalizedVariation };
      }));

      return info;
    } catch {
      return null;
    }
  }

  const lineSubtotal = useMemo(() => lines.reduce((s, l) => s + l.qty * l.unitPrice, 0), [lines]);
  const subtotal = lineSubtotal;
  const total = subtotal + shipping;


  useEffect(() => {
    if (!open) return;
    // Load products list once
    if (!products.length) {
      fetch(`${apiBase}/products-picker`).then(async (r) => {
        if (r.ok) setProducts(await r.json());
      }).catch(() => {});
    }
    // Load available order-status slugs
    if (!statusList.length) {
      setStatusList(['confirme', 'en-attente', 'tentative', 'annule']);
    }
    if (!Object.keys(employeeNames).length) {
      fetch('/api/employees-directory').then(async (r) => {
        if (!r.ok) return;
        const list = (await r.json()) as { id: string; name: string }[];
        setEmployeeNames(Object.fromEntries(list.map((e) => [e.id, e.name])));
      }).catch(() => {});
    }
    if (orderId) {
      setLoading(true);
      setProductInfo({});
      fetch(`${apiBase}/orders/${orderId}`)
        .then((r) => r.json())
        .then((o: OrderResponse) => {
          setStatus(o.status);
          setOriginalStatus(String(o.status));
          setAttempts(Number(o.meta?._mzem_attempts ?? 1));

          // Assignment history — fall back to current pointer if no array is stored.
          let history: AssignmentEntry[] = [];
          const rawHistory = o.meta?._mzem_assignment_history;
          if (typeof rawHistory === 'string' && rawHistory.trim().startsWith('[')) {
            try { history = JSON.parse(rawHistory) as AssignmentEntry[]; } catch { /* ignore malformed */ }
          } else if (Array.isArray(rawHistory)) {
            history = rawHistory as AssignmentEntry[];
          }
          if (history.length === 0 && o.assignedEmployeeId) {
            history = [{
              employeeId: o.assignedEmployeeId,
              at: o.assignedAt ?? o.createdAt,
              by: (o.meta?._mzem_assigned_by as 'auto' | 'admin' | 'employee') ?? 'auto',
            }];
          }
          setAssignmentHistory(history);
          setDeliveryCompany(String((o.meta?._mzem_delivery_company as string) ?? ''));
          setExchange(o.meta?._mzem_exchange === 'yes');
          setShipping(o.shipping ?? 8);
          setPrivateNote(String((o.meta?._mzem_private_note as string) ?? ''));
          setCustomer({
            firstName: o.customer.firstName ?? '',
            phone: o.customer.phone ?? '',
            city: o.customer.city ?? '',
            address: o.customer.address ?? '',
            phone2: String((o.meta?._mzem_phone_2 as string) ?? ''),
            email: o.customer.email ?? '',
            note: '',
          });
          setLines(o.items.map((i) => parseLine(i)));
          // Lazy-load product info (options + bundles) for each product in the order
          const uniqueIds = Array.from(new Set(o.items.map((i) => i.productId)));
          uniqueIds.forEach((pid) => { void ensureProductInfo(pid); });
        })
        .catch(() => alert('Erreur de chargement de la commande'))
        .finally(() => setLoading(false));
    } else {
      // reset on open-for-create — default to "en-attente" so the new order
      // lands in the Normal tab (which filters on the French statuses).
      setStatus('en-attente');
      setOriginalStatus('');
      setAttempts(1);
      setAssignmentHistory([]);
      setHistoryOpen(false);
      setDeliveryCompany('');
      setExchange(false);
      setShipping(8);
      setPrivateNote('');
      setCustomer({ firstName: '', phone: '', city: '', address: '', phone2: '', email: '', note: '' });
      setLines([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId]);

  // Close picker on click outside
  useEffect(() => {
    if (!pickerOpen) return;
    function onPointer(e: PointerEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [pickerOpen]);

  const filteredProducts = useMemo(() => {
    const q = pickerQuery.toLowerCase().trim();
    if (!q) return products.slice(0, 30);
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 30);
  }, [products, pickerQuery]);

  async function addProduct(p: ProductPickerItem) {
    setPickerOpen(false);
    setPickerQuery('');
    // Load the product's full info first so we know whether it has bundles
    const info = await ensureProductInfo(p.id);
    const defaultBundle = info?.bundles.find((b) => b.quantity > 0);
    if (defaultBundle && defaultBundle.quantity > 1) {
      // Add one slot row per bundle item — user can switch to another bundle via the dropdown.
      const perSlotPrice = defaultBundle.price / Math.max(1, defaultBundle.quantity);
      const slots: LineDraft[] = Array.from({ length: defaultBundle.quantity }, (_, k) => ({
        productId: p.id,
        name: p.name,
        image: p.image,
        qty: 1,
        unitPrice: perSlotPrice,
        variation: {},
        bundleName: defaultBundle.name,
        slotIndex: k + 1,
      }));
      setLines((prev) => [...prev, ...slots]);
    } else if (defaultBundle && defaultBundle.quantity === 1) {
      // Single-item bundle: still tag the line so it shows the bundle dropdown header.
      setLines((prev) => [...prev, {
        productId: p.id, name: p.name, image: p.image, qty: 1, unitPrice: defaultBundle.price,
        variation: {}, bundleName: defaultBundle.name, slotIndex: 1,
      }]);
    } else {
      setLines((prev) => [...prev, {
        productId: p.id, name: p.name, image: p.image, qty: 1, unitPrice: p.price, variation: {},
      }]);
    }
  }
  function setLine(idx: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function setLineVariation(idx: number, attrName: string, value: string) {
    setLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const cleanVariation: Record<string, string> = {};
      const targetKey = attrName.toLowerCase().trim();
      for (const [k, v] of Object.entries(l.variation)) {
        if (k.toLowerCase().trim() !== targetKey) {
          cleanVariation[k] = v;
        }
      }
      cleanVariation[attrName] = value;
      return { ...l, variation: cleanVariation };
    }));
  }
  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }
  function removeBundleGroup(productId: string, bundleName: string) {
    setLines((prev) => prev.filter((l) => !(l.productId === productId && l.bundleName === bundleName)));
  }
  function switchBundle(productId: string, oldBundleName: string, newBundle: { name: string; quantity: number; price: number }) {
    const info = productInfo[productId];
    setLines((prev) => {
      const groupLines = prev.filter((l) => l.productId === productId && l.bundleName === oldBundleName);
      const others = prev.filter((l) => !(l.productId === productId && l.bundleName === oldBundleName));
      const first = groupLines[0];
      if (!first) return prev;
      const newSlots = Array.from({ length: newBundle.quantity }, (_, k) => ({
        productId,
        name: first.name,
        image: first.image,
        qty: 1,
        unitPrice: newBundle.price / Math.max(1, newBundle.quantity),
        variation: groupLines[k]?.variation ?? {},
        bundleName: newBundle.name,
        slotIndex: k + 1,
      }));
      void info; // info present means dropdowns are populated
      return [...others, ...newSlots];
    });
  }

  async function save() {
    if (saveInFlightRef.current) return;
    if (!customer.firstName || !customer.phone) {
      alert('Nom et téléphone obligatoires.');
      return;
    }
    if (!lines.length) {
      alert('Ajoutez au moins un produit.');
      return;
    }
    saveInFlightRef.current = true;
    setSaving(true);
    try {
      const statusChanged = isEdit && status && status !== originalStatus;
      const payload: Record<string, unknown> = {
        customer,
        items: lines.map((l) => ({
          productId: l.productId,
          name: l.name,
          qty: l.qty,
          unitPrice: l.unitPrice,
          price: l.unitPrice,
          image: l.image ?? '',
          variation: l.variation,
          bundleName: l.bundleName,
          bundleSlot: l.slotIndex,
        })),
        shipping,
        subtotal: money(subtotal),
        total: money(total),
        deliveryCompany,
        exchange,
        privateNote,
        paymentMethod: 'cod' as const,
      };
      // On create, always send a status (default en-attente) so the order is
      // queryable in the admin Normal tab; on edit, only send when it changed.
      if (!isEdit) payload.status = status || 'en-attente';
      else if (statusChanged) payload.status = status;
      payload.attempts = attempts;
      const url = isEdit ? `${apiBase}/orders/${orderId}` : '/api/admin/orders';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erreur');
      const order = await res.json();

      onSaved?.(order);
      onClose();
    } catch (e) {
      alert(`Échec: ${e instanceof Error ? e.message : 'inconnu'}`);
    } finally {
      setSaving(false);
      saveInFlightRef.current = false;
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? `Modifier la commande` : 'Créer une commande'}
      actions={
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white shadow-soft hover:bg-brand-600 disabled:opacity-50">
          <Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      }
    >
      {loading ? (
        <p className="p-10 text-center text-ink-700">Chargement…</p>
      ) : (
        <div className="space-y-5">
          {/* Détails de la commande */}
          <Card title="Détails de la commande" right={
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={exchange} onChange={(e) => setExchange(e.target.checked)} className="h-4 w-4 accent-brand-500" />
              Échange
            </label>
          }>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Statut">
                <select className="input" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
                  <option value="">— Par défaut —</option>
                  {statusList.map((s) => (
                    <option key={s} value={s}>
                      {s === 'tentative' ? `Tentative ${attempts}` : labelFor(s)}
                    </option>
                  ))}
                </select>
              </Field>

              {status === 'tentative' && (
                <Field label="Attempt">
                  <div className="flex items-center gap-1 mt-1">
                    <button
                      type="button"
                      onClick={() => setAttempts((v) => Math.max(1, v - 1))}
                      className="grid h-12 w-12 place-items-center rounded-xl border border-ink-200 bg-white text-ink-900 font-bold hover:bg-ink-100 transition active:scale-95"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={attempts}
                      onChange={(e) => setAttempts(Math.max(1, Number(e.target.value) || 1))}
                      className="h-12 w-28 rounded-xl border border-ink-200 bg-white px-4 text-center font-black outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-50 text-ink-900"
                    />
                    <button
                      type="button"
                      onClick={() => setAttempts((v) => v + 1)}
                      className="grid h-12 w-12 place-items-center rounded-xl border border-ink-200 bg-white text-ink-900 font-bold hover:bg-ink-100 transition active:scale-95"
                    >
                      +
                    </button>
                  </div>
                </Field>
              )}
            </div>
            <Field label="Ajouter une note privée…" className="mt-4">
              <textarea rows={3} className="input" value={privateNote} onChange={(e) => setPrivateNote(e.target.value)} placeholder="Ajouter une note privée…" />
            </Field>
          </Card>

          {/* Détails du client */}

          <Card title="Détails du client">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nom"><input className="input" value={customer.firstName} onChange={(e) => setCustomer({ ...customer, firstName: e.target.value })} placeholder="Entrez votre nom" /></Field>
              <Field label="Téléphone"><input className="input" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} placeholder="Entrez votre numéro de téléphone" /></Field>
              <Field label="Ville">
                <select className="input" value={customer.city} onChange={(e) => setCustomer({ ...customer, city: e.target.value })}>
                  <option value="">Sélectionner Ville</option>
                  {SITE.cities.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Adresse"><input className="input" value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} placeholder="Entrez votre adresse" /></Field>
              <Field label="Téléphone 2"><input className="input" value={customer.phone2} onChange={(e) => setCustomer({ ...customer, phone2: e.target.value })} placeholder="Entrez votre second numéro de téléphone" /></Field>
              <Field label="Email"><input type="email" className="input" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} placeholder="Entrez votre email" /></Field>
            </div>
            <Field label="Note" className="mt-4">
              <textarea rows={3} className="input" value={customer.note} onChange={(e) => setCustomer({ ...customer, note: e.target.value })} placeholder="Entrez les notes supplémentaires" />
            </Field>
          </Card>

          {/* Sélectionner un produit */}
          <Card title="Sélectionner un produit">
            <div className="relative" ref={pickerRef}>
              <input
                className="input"
                placeholder="Produits"
                value={pickerQuery}
                onChange={(e) => { setPickerQuery(e.target.value); setPickerOpen(true); }}
                onFocus={() => setPickerOpen(true)}
              />
              {pickerOpen && (
                <div className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-ink-200 bg-white shadow-card">
                  {filteredProducts.length === 0 && <p className="p-4 text-sm text-ink-700">Aucun produit.</p>}
                  {filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addProduct(p)}
                      className="flex w-full items-center gap-3 border-b border-ink-200 px-3 py-2 text-left last:border-0 hover:bg-ink-100"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.image ? <img src={p.image} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <div className="h-10 w-10 rounded-lg bg-ink-200" />}
                      <span className="flex-1 text-sm font-bold">{p.name}</span>
                      <span className="text-sm font-black text-brand-500">{formatPrice(p.price)}</span>
                      <Plus size={16} className="text-brand-500" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Résumé des commandes */}
          <Card title="Résumé des commandes">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-separate border-spacing-0 text-sm min-w-[860px]">
                <colgroup>
                  <col className="w-[220px]" />
                  <col className="w-[90px]" />
                  <col />
                  <col className="w-[110px]" />
                  <col className="w-[90px]" />
                  <col className="w-[60px]" />
                </colgroup>
                <thead className="text-[10px] uppercase tracking-wider text-ink-700">
                  <tr className="bg-ink-100">
                    <th className="rounded-l-xl px-4 py-3 text-left font-bold">Produit</th>
                    <th className="px-3 py-3 text-left font-bold">Qté</th>
                    <th className="px-3 py-3 text-left font-bold">Attributs</th>
                    <th className="px-3 py-3 text-right font-bold">Prix unitaire</th>
                    <th className="px-3 py-3 text-right font-bold">Total</th>
                    <th className="rounded-r-xl px-3 py-3 text-right font-bold"></th>
                  </tr>
                </thead>
                <tbody>
                  {renderSummaryRows({
                    lines,
                    productInfo,
                    setLine,
                    setLineVariation,
                    removeLine,
                    removeBundleGroup,
                    switchBundle,
                  })}
                  {lines.length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-12 text-center text-ink-700">La scène est prête pour vos produits ! ✨🎉</td></tr>
                  )}
                </tbody>
                {lines.length > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={2} />
                      <td colSpan={4} className="px-3 pt-4">
                        <div className="ml-auto max-w-sm space-y-2 rounded-xl bg-ink-100 px-4 py-3">
                          <div className="flex items-center justify-between gap-3 text-ink-700">
                            <span className="text-xs font-bold uppercase tracking-wider">Sous-total</span>
                            <span className="whitespace-nowrap text-sm font-bold">{formatPrice(subtotal)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3 text-ink-700">
                            <span className="text-xs font-bold uppercase tracking-wider">Livraison</span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={shipping}
                                onChange={(e) => setShipping(Math.max(0, parseFloat(e.target.value) || 0))}
                                className="h-8 w-20 rounded-lg border border-ink-200 bg-white px-2 text-right text-sm font-bold text-ink-900 outline-none focus:border-brand-500"
                              />
                              <span className="text-xs font-bold text-ink-700">DT</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-3 border-t border-ink-200 pt-2">
                            <span className="text-xs font-black uppercase tracking-wider text-ink-900">Total</span>
                            <span className="whitespace-nowrap text-lg font-black text-brand-500">{formatPrice(total)}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>

          {isEdit && orderId && apiBase === '/api/admin' && (
            <BestDeliveryPanel orderId={orderId} />
          )}
        </div>
      )}
    </Drawer>
  );
}

/** Group consecutive lines by (productId + bundleName) and render either a bundle group or a solo row. */
function renderSummaryRows(args: {
  lines: LineDraft[];
  productInfo: Record<string, ProductInfo>;
  setLine: (idx: number, patch: Partial<LineDraft>) => void;
  setLineVariation: (idx: number, attrName: string, value: string) => void;
  removeLine: (idx: number) => void;
  removeBundleGroup: (productId: string, bundleName: string) => void;
  switchBundle: (productId: string, oldBundleName: string, b: { name: string; quantity: number; price: number }) => void;
}): React.ReactNode {
  const { lines, productInfo, setLine, setLineVariation, removeLine, removeBundleGroup, switchBundle } = args;

  // Build groups while preserving original indices for setLine/removeLine.
  type Indexed = LineDraft & { _i: number };
  const indexed: Indexed[] = lines.map((l, i) => ({ ...l, _i: i }));
  const groups: { key: string; productId: string; bundleName?: string; items: Indexed[] }[] = [];
  for (const l of indexed) {
    const key = `${l.productId}|${l.bundleName ?? ''}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key && l.bundleName) {
      last.items.push(l);
    } else {
      groups.push({ key, productId: l.productId, bundleName: l.bundleName, items: [l] });
    }
  }

  const rows: React.ReactNode[] = [];
  for (const g of groups) {
    const info = productInfo[g.productId];
    const attrs = info?.options ?? [];
    const bundles = info?.bundles ?? [];

    if (g.bundleName) {
      // Bundle group header row
      rows.push(
        <tr key={`${g.key}-h`} className="bg-brand-50/50">
          <td className="rounded-l-xl px-4 py-3 align-middle" colSpan={5}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-brand-700">
                Bundle
              </span>
              <select
                value={g.bundleName ?? ''}
                onChange={(e) => {
                  const next = bundles.find((b) => b.name === e.target.value);
                  if (next) switchBundle(g.productId, g.bundleName!, next);
                }}
                className="min-h-[36px] flex-1 max-w-xs rounded-xl border border-ink-200 bg-white px-3 text-sm font-bold text-ink-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-50 outline-none"
              >
                <option value={g.bundleName}>{g.bundleName}</option>
                {bundles.filter((b) => b.name !== g.bundleName).map((b) => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
              </select>
              <span className="text-xs text-ink-700">{g.items.length} article{g.items.length > 1 ? 's' : ''}</span>
            </div>
          </td>
          <td className="rounded-r-xl px-3 py-3 text-right">
            <button
              type="button"
              onClick={() => removeBundleGroup(g.productId, g.bundleName!)}
              className="rounded-lg p-2 text-red-500 hover:bg-red-50"
              title="Supprimer le bundle"
            >
              <Trash2 size={16} />
            </button>
          </td>
        </tr>,
      );

      g.items.forEach((l, k) => {
        const isFirst = k === 0;
        const isLast = k === g.items.length - 1;
        rows.push(
          <tr key={`${g.key}-${l._i}`} className={isLast ? 'border-b-2 border-brand-100/40' : ''}>
            <td className={`px-4 py-3 align-middle ${isFirst ? '' : 'pt-0'}`}>
              {isFirst ? (
                <div className="flex items-center gap-3">
                  {l.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={l.image} alt="" className="h-11 w-11 flex-none rounded-xl object-cover ring-1 ring-ink-200" />
                  ) : (
                    <div className="h-11 w-11 flex-none rounded-xl bg-ink-100" />
                  )}
                  <span className="line-clamp-2 break-words font-bold text-ink-900" title={l.name}>{l.name}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 pl-14 text-xs text-ink-700">
                  <span className="inline-flex h-5 min-w-[42px] items-center justify-center rounded-full bg-brand-100 px-2 text-[10px] font-black text-brand-700">
                    Item {k + 1}
                  </span>
                </div>
              )}
            </td>
            <td className="px-3 py-3 align-middle">
              <NumberField
                value={l.qty}
                onChange={(v) => setLine(l._i, { qty: Math.max(1, v) })}
                min={1}
                blankOnZero={false}
                live
                className="h-9 w-16 rounded-lg border border-ink-200 bg-white px-2 text-center text-sm font-bold outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-50"
              />
            </td>
            <td className="px-3 py-3 align-middle">
              <VariationSelects
                attrs={attrs}
                value={l.variation}
                onChange={(name, v) => setLineVariation(l._i, name, v)}
              />
            </td>
            <td className="px-3 py-3 align-middle text-right">
              <NumberField
                value={l.unitPrice}
                onChange={(v) => setLine(l._i, { unitPrice: v })}
                step={0.01}
                decimals={2}
                live
                className="h-9 w-24 rounded-lg border border-ink-200 bg-white px-2 text-right text-sm font-bold outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-50"
              />
            </td>
            <td className="px-3 py-3 align-middle text-right text-sm font-black text-ink-900 whitespace-nowrap">{formatPrice(l.qty * l.unitPrice)}</td>
            <td className="px-3 py-3 align-middle text-right">
              {!isFirst && (
                <button
                  type="button"
                  onClick={() => removeLine(l._i)}
                  className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                  title="Retirer cet item"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </td>
          </tr>,
        );
      });
    } else {
      // Solo line
      const l = g.items[0];
      rows.push(
        <tr key={`${g.key}-${l._i}`} className="border-t border-ink-200">
          <td className="px-4 py-3 align-middle">
            <div className="flex items-center gap-3">
              {l.image ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={l.image} alt="" className="h-11 w-11 flex-none rounded-xl object-cover ring-1 ring-ink-200" />
              ) : (
                <div className="h-11 w-11 flex-none rounded-xl bg-ink-100" />
              )}
              <span className="line-clamp-2 break-words font-bold text-ink-900" title={l.name}>{l.name}</span>
            </div>
          </td>
          <td className="px-3 py-3 align-middle">
            <NumberField
              value={l.qty}
              onChange={(v) => setLine(l._i, { qty: Math.max(1, v) })}
              min={1}
              blankOnZero={false}
              live
              className="h-9 w-16 rounded-lg border border-ink-200 bg-white px-2 text-center text-sm font-bold outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-50"
            />
          </td>
          <td className="px-3 py-3 align-middle">
            <VariationSelects
              attrs={attrs}
              value={l.variation}
              onChange={(name, v) => setLineVariation(l._i, name, v)}
            />
          </td>
          <td className="px-3 py-3 align-middle text-right">
            <NumberField
              value={l.unitPrice}
              onChange={(v) => setLine(l._i, { unitPrice: v })}
              step={0.01}
              decimals={2}
              live
              className="h-9 w-24 rounded-lg border border-ink-200 bg-white px-2 text-right text-sm font-bold outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-50"
            />
          </td>
          <td className="px-3 py-3 align-middle text-right text-sm font-black text-ink-900 whitespace-nowrap">{formatPrice(l.qty * l.unitPrice)}</td>
          <td className="px-3 py-3 align-middle text-right">
            <button
              type="button"
              onClick={() => removeLine(l._i)}
              className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
              title="Retirer"
            >
              <Trash2 size={14} />
            </button>
          </td>
        </tr>,
      );
    }
  }
  return rows;
}

/** One <select> per known product attribute, free-form fallback when no options were configured. */
function VariationSelects({
  attrs, value, onChange,
}: {
  attrs: { name: string; values: string[] }[];
  value: Record<string, string>;
  onChange: (name: string, v: string) => void;
}) {
  // If we don't have option metadata yet, just show whatever the order has as chips.
  if (!attrs.length) {
    const entries = Object.entries(value).filter(([, v]) => v);
    if (!entries.length) return <span className="text-ink-700">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {entries.map(([k, v]) => (
          <span key={k} className="rounded-md bg-ink-100 px-2 py-0.5 text-[11px] font-bold text-ink-700">
            <span className="opacity-70">{k}:</span> {v}
          </span>
        ))}
      </div>
    );
  }

  // Find helper to get value case-insensitively
  const getValueCaseInsensitive = (key: string): string => {
    const target = key.toLowerCase().trim();
    for (const [k, v] of Object.entries(value)) {
      if (k.toLowerCase().trim() === target) return v;
    }
    return '';
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {attrs.map((a) => {
        const val = getValueCaseInsensitive(a.name);
        const filled = !!val;
        return (
          <label key={a.name} className="relative">
            <span className="pointer-events-none absolute left-2 top-0.5 text-[9px] font-bold uppercase tracking-wider text-ink-700">
              {a.name}
            </span>
            <select
              value={val}
              onChange={(e) => onChange(a.name, e.target.value)}
              className={`h-10 w-[110px] min-w-0 rounded-lg border bg-white pl-2 pr-6 pt-3 pb-0 text-xs font-bold outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-50 ${
                filled ? 'border-brand-300 text-brand-700' : 'border-ink-200 text-ink-700'
              }`}
            >
              <option value="">—</option>
              {a.values.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}

function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-ink-200 bg-white">
      <header className="flex items-center justify-between border-b border-ink-200 px-5 py-3">
        <h3 className="text-sm font-black uppercase tracking-wide text-ink-900">{title}</h3>
        {right}
      </header>
      <div className="p-5">{children}</div>
    </section>
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
