'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Tag, Trash2, Edit, Plus } from 'lucide-react';
import type { Category } from '@/types';

export default function CategoriesView({ initial }: { initial: Category[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [parentId, setParentId] = useState('');
  const [description, setDescription] = useState('');

  function openCreate() { setEditing(null); setName(''); setSlug(''); setParentId(''); setDescription(''); setOpen(true); }
  function openEdit(c: Category) {
    setEditing(c); setName(c.name); setSlug(c.slug); setParentId(c.parentId ?? ''); setDescription(c.description ?? ''); setOpen(true);
  }

  async function save() {
    const body = { name, slug: slug || undefined, parentId: parentId || null, description };
    const url = editing ? `/api/admin/categories/${editing.id}` : '/api/admin/categories';
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) { alert('Erreur'); return; }
    setOpen(false);
    startTransition(() => router.refresh());
  }

  async function remove(c: Category) {
    if (!confirm(`Supprimer la catégorie « ${c.name} » ?`)) return;
    const res = await fetch(`/api/admin/categories/${c.id}`, { method: 'DELETE' });
    if (!res.ok) { alert('Erreur de suppression'); return; }
    startTransition(() => router.refresh());
  }

  return (
    <div className="p-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-black">Catégories</h1>
        <button onClick={openCreate} className="btn-primary inline-flex items-center gap-2">
          <Plus size={16} /> Ajouter une catégorie
        </button>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {initial.map((c) => (
          <article key={c.id} className={`card flex items-center gap-4 p-5 ${pending ? 'opacity-60' : ''}`}>
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-100 text-brand-500"><Tag /></div>
            <div className="flex-1">
              <h3 className="font-bold">{c.name}</h3>
              <p className="text-sm text-ink-700">{c.slug} · {c.productCount} produits</p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => openEdit(c)} className="rounded-lg p-2 text-ink-700 hover:bg-ink-100" title="Modifier"><Edit size={16} /></button>
              <button onClick={() => remove(c)} className="rounded-lg p-2 text-red-500 hover:bg-red-50" title="Supprimer"><Trash2 size={16} /></button>
            </div>
          </article>
        ))}
        {!initial.length && <p className="col-span-full p-8 text-center text-ink-700">Aucune catégorie.</p>}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-xl font-black">{editing ? 'Modifier la catégorie' : 'Ajouter une catégorie'}</h2>
            <div className="space-y-3">
              <label className="block text-sm font-bold">Nom<input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} /></label>
              <label className="block text-sm font-bold">Slug<input className="input mt-1" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="généré automatiquement" /></label>
              <label className="block text-sm font-bold">Parent
                <select className="input mt-1" value={parentId} onChange={(e) => setParentId(e.target.value)}>
                  <option value="">Aucun</option>
                  {initial.filter((c) => !editing || c.id !== editing.id).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-bold">Description<textarea className="input mt-1" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="btn-ghost">Annuler</button>
              <button onClick={save} className="btn-primary">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
