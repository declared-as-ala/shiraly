'use client';
import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  UserCircle, Lock, Eye, EyeOff, Check, AlertCircle, KeyRound, ImageIcon, Phone, Plus, Trash2,
  Globe, Images, MoveUp, MoveDown, Users, LogOut, UserPlus,
} from 'lucide-react';
import ImageUploader from '@/components/admin/ImageUploader';
import { PageHeader, Field, ConfirmDialog, EmptyState } from '@/components/admin/ui';

type Account = { id: string | null; name: string; email: string; avatarUrl: string | null; createdAt: string | null };
type TeamMember = { id: string; name: string; email: string; avatarUrl: string | null; createdAt: string | null };
type Status = { kind: 'ok' | 'err'; msg: string } | null;

type Slide = { imageUrl: string; title: string; subtitle: string; buttonText: string; buttonLink: string };
type SiteInfo = {
  photoUrl: string; phones: string[]; whatsapp: string;
  instagram: string; tiktok: string; facebook: string; slides: Slide[];
};

export default function ProfileView() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // ── Account ───────────────────────────────────────────────────────────
  const [account, setAccount] = useState<Account>({ id: null, name: '', email: '', avatarUrl: null, createdAt: null });
  const [accountStatus, setAccountStatus] = useState<Status>(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountLoading, setAccountLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/profile')
      .then((r) => r.json())
      .then((d: Account) => setAccount({ id: d.id ?? null, name: d.name ?? '', email: d.email ?? '', avatarUrl: d.avatarUrl ?? null, createdAt: d.createdAt ?? null }))
      .catch(() => {})
      .finally(() => setAccountLoading(false));
  }, []);

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault();
    setAccountStatus(null);
    setAccountBusy(true);
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: account.name, email: account.email, avatarUrl: account.avatarUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Erreur');
      setAccount((a) => ({ ...a, ...data }));
      setAccountStatus({ kind: 'ok', msg: 'Profil mis à jour.' });
      startTransition(() => router.refresh());
    } catch (err) {
      setAccountStatus({ kind: 'err', msg: err instanceof Error ? err.message : 'Erreur' });
    } finally {
      setAccountBusy(false);
    }
  }

  // ── Password ──────────────────────────────────────────────────────────
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [pwStatus, setPwStatus] = useState<Status>(null);
  const [pwBusy, setPwBusy] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwStatus(null);
    if (!next || next !== confirm) { setPwStatus({ kind: 'err', msg: 'Les mots de passe ne correspondent pas.' }); return; }
    if (next.length < 6) { setPwStatus({ kind: 'err', msg: 'Au moins 6 caractères.' }); return; }
    setPwBusy(true);
    try {
      const res = await fetch('/api/admin/profile/password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next, confirmPassword: confirm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Erreur');
      setPwStatus({ kind: 'ok', msg: 'Mot de passe mis à jour.' });
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      setPwStatus({ kind: 'err', msg: err instanceof Error ? err.message : 'Erreur' });
    } finally {
      setPwBusy(false);
    }
  }

  // ── Team ──────────────────────────────────────────────────────────────
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [teamStatus, setTeamStatus] = useState<Status>(null);
  const [newMember, setNewMember] = useState({ name: '', email: '', password: '' });
  const [addBusy, setAddBusy] = useState(false);
  const [toDelete, setToDelete] = useState<TeamMember | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  function loadTeam() {
    fetch('/api/admin/users').then((r) => r.json()).then((d: TeamMember[]) => Array.isArray(d) && setTeam(d)).catch(() => {});
  }
  useEffect(loadTeam, []);

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setTeamStatus(null);
    setAddBusy(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMember),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Erreur');
      setTeam((t) => [...t, data]);
      setNewMember({ name: '', email: '', password: '' });
      setTeamStatus({ kind: 'ok', msg: 'Administrateur ajouté.' });
    } catch (err) {
      setTeamStatus({ kind: 'err', msg: err instanceof Error ? err.message : 'Erreur' });
    } finally {
      setAddBusy(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${toDelete.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Erreur');
      setTeam((t) => t.filter((m) => m.id !== toDelete.id));
      setTeamStatus({ kind: 'ok', msg: 'Administrateur supprimé.' });
    } catch (err) {
      setTeamStatus({ kind: 'err', msg: err instanceof Error ? err.message : 'Erreur' });
    } finally {
      setDeleteBusy(false);
      setToDelete(null);
    }
  }

  // ── Site info + slides (preserved) ──────────────────────────────────────
  const [siteInfo, setSiteInfo] = useState<SiteInfo>({ photoUrl: '', phones: [''], whatsapp: '', instagram: '', tiktok: '', facebook: '', slides: [] });
  const [siteStatus, setSiteStatus] = useState<Status>(null);
  const [siteBusy, setSiteBusy] = useState(false);

  useEffect(() => {
    fetch('/api/admin/site-settings').then((r) => r.json()).then((d: SiteInfo) => setSiteInfo({
      photoUrl: d.photoUrl ?? '', phones: d.phones?.length ? d.phones : [''], whatsapp: d.whatsapp ?? '',
      instagram: d.instagram ?? '', tiktok: d.tiktok ?? '', facebook: d.facebook ?? '', slides: d.slides ?? [],
    })).catch(() => {});
  }, []);

  async function saveSiteInfo(e: React.FormEvent) {
    e.preventDefault();
    setSiteStatus(null);
    const phones = siteInfo.phones.map((p) => p.trim()).filter(Boolean);
    if (!phones.length) { setSiteStatus({ kind: 'err', msg: 'Au moins un numéro de téléphone requis.' }); return; }
    setSiteBusy(true);
    try {
      const res = await fetch('/api/admin/site-settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...siteInfo, phones }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Erreur');
      setSiteStatus({ kind: 'ok', msg: 'Informations mises à jour.' });
      startTransition(() => router.refresh());
    } catch (err) {
      setSiteStatus({ kind: 'err', msg: err instanceof Error ? err.message : 'Erreur' });
    } finally {
      setSiteBusy(false);
    }
  }

  function updateSlide(i: number, patch: Partial<Slide>) {
    setSiteInfo((prev) => { const s = [...prev.slides]; s[i] = { ...s[i], ...patch }; return { ...prev, slides: s }; });
  }

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/admin-login');
  }

  return (
    <div className={`p-6 md:p-8 ${pending ? 'opacity-70' : ''}`}>
      <PageHeader
        title="Profil & Paramètres"
        subtitle="Gérez votre compte, votre équipe et les réglages de la boutique."
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Profil' }]}
        actions={
          <button onClick={logout} className="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm font-bold text-ink-900 hover:bg-ink-100">
            <LogOut size={16} /> Déconnexion
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Account */}
        <form onSubmit={saveAccount} className="card p-6 lg:col-span-2">
          <h2 className="mb-5 flex items-center gap-2 text-lg font-black"><UserCircle size={18} className="text-brand-500" /> Mon compte</h2>
          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="flex flex-col items-center gap-2">
              <div className="relative h-24 w-24 overflow-hidden rounded-2xl border border-ink-200 bg-sand-200">
                {account.avatarUrl ? (
                  <Image src={account.avatarUrl} alt="avatar" fill className="object-cover" unoptimized />
                ) : (
                  <span className="grid h-full w-full place-items-center text-brand-400"><UserCircle size={44} /></span>
                )}
              </div>
              <ImageUploader
                onUploaded={(img) => setAccount((a) => ({ ...a, avatarUrl: img.url }))}
                className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-bold text-ink-900 hover:bg-ink-100"
              >
                <span className="flex items-center gap-1"><ImageIcon size={12} className="text-brand-500" /> Changer</span>
              </ImageUploader>
            </div>
            <div className="grid flex-1 gap-4 sm:grid-cols-2">
              <Field label="Nom"><input className="input" value={account.name} onChange={(e) => setAccount((a) => ({ ...a, name: e.target.value }))} placeholder="Votre nom" /></Field>
              <Field label="Email"><input type="email" className="input" value={account.email} onChange={(e) => setAccount((a) => ({ ...a, email: e.target.value }))} placeholder="vous@exemple.com" /></Field>
            </div>
          </div>
          {accountStatus && <StatusLine status={accountStatus} />}
          <button disabled={accountBusy || accountLoading} className="btn-primary mt-5 inline-flex items-center gap-2 disabled:opacity-50">
            <Check size={16} /> {accountBusy ? 'Enregistrement…' : 'Enregistrer le profil'}
          </button>
        </form>

        {/* Password */}
        <form onSubmit={changePassword} className="card p-6">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-black"><Lock size={18} className="text-brand-500" /> Mot de passe</h2>
          <p className="mb-4 text-sm text-ink-500">Minimum 6 caractères.</p>
          <div className="space-y-3">
            <PasswordField label="Mot de passe actuel" value={current} onChange={setCurrent} show={showCurrent} onToggleShow={() => setShowCurrent(!showCurrent)} autoComplete="current-password" />
            <PasswordField label="Nouveau mot de passe" value={next} onChange={setNext} show={showNext} onToggleShow={() => setShowNext(!showNext)} autoComplete="new-password" />
            <PasswordField label="Confirmer" value={confirm} onChange={setConfirm} show={showNext} onToggleShow={() => setShowNext(!showNext)} autoComplete="new-password" />
          </div>
          {pwStatus && <StatusLine status={pwStatus} />}
          <button disabled={pwBusy} className="btn-primary mt-4 inline-flex w-full items-center justify-center gap-2 disabled:opacity-50">
            <KeyRound size={16} /> {pwBusy ? 'Mise à jour…' : 'Mettre à jour'}
          </button>
        </form>
      </div>

      {/* Team / Administrators */}
      <section className="card mt-6 p-6">
        <h2 className="mb-5 flex items-center gap-2 text-lg font-black"><Users size={18} className="text-brand-500" /> Administrateurs</h2>

        <div className="space-y-2">
          {team.length === 0 ? (
            <EmptyState icon={Users} title="Aucun administrateur enregistré" description="Ajoutez le premier membre de l'équipe ci-dessous." />
          ) : team.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-xl border border-ink-200 bg-sand-50 px-4 py-3">
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-sand-300">
                {m.avatarUrl ? <Image src={m.avatarUrl} alt="" fill className="object-cover" unoptimized /> : <span className="grid h-full w-full place-items-center text-brand-500"><UserCircle size={22} /></span>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-ink-900">{m.name}</p>
                <p className="truncate text-xs text-ink-500">{m.email}</p>
              </div>
              <button onClick={() => setToDelete(m)} className="rounded-lg p-2 text-red-500 hover:bg-red-50" aria-label={`Supprimer ${m.name}`}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>

        <form onSubmit={addMember} className="mt-5 grid gap-3 rounded-xl border border-dashed border-ink-300 p-4 md:grid-cols-[1fr_1fr_1fr_auto]">
          <Field label="Nom"><input className="input" value={newMember.name} onChange={(e) => setNewMember((m) => ({ ...m, name: e.target.value }))} required /></Field>
          <Field label="Email"><input type="email" className="input" value={newMember.email} onChange={(e) => setNewMember((m) => ({ ...m, email: e.target.value }))} required /></Field>
          <Field label="Mot de passe"><input type="password" className="input" value={newMember.password} onChange={(e) => setNewMember((m) => ({ ...m, password: e.target.value }))} minLength={6} required /></Field>
          <button disabled={addBusy} className="btn-primary inline-flex h-[46px] items-center gap-2 self-end disabled:opacity-50">
            <UserPlus size={16} /> {addBusy ? '…' : 'Ajouter'}
          </button>
        </form>
        {teamStatus && <StatusLine status={teamStatus} />}
      </section>

      {/* Site info */}
      <form onSubmit={saveSiteInfo} className="card mt-6 p-6">
        <h2 className="mb-5 flex items-center gap-2 text-lg font-black"><Globe size={18} className="text-brand-500" /> Informations de la boutique</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-ink-700"><Phone size={13} /> Téléphones</p>
            <div className="space-y-2">
              {siteInfo.phones.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="tel" className="input flex-1" value={p} onChange={(e) => setSiteInfo((s) => { const phones = [...s.phones]; phones[i] = e.target.value; return { ...s, phones }; })} placeholder="ex: 20670621" />
                  {siteInfo.phones.length > 1 && <button type="button" onClick={() => setSiteInfo((s) => ({ ...s, phones: s.phones.filter((_, idx) => idx !== i) }))} className="rounded-lg p-2 text-red-500 hover:bg-red-50" aria-label="Supprimer"><Trash2 size={16} /></button>}
                </div>
              ))}
              <button type="button" onClick={() => setSiteInfo((s) => ({ ...s, phones: [...s.phones, ''] }))} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-ink-300 px-3 py-1.5 text-xs font-bold text-ink-700 hover:bg-ink-100"><Plus size={13} /> Ajouter un numéro</button>
            </div>
          </div>
          <Field label="Instagram"><input type="url" className="input" value={siteInfo.instagram} onChange={(e) => setSiteInfo((s) => ({ ...s, instagram: e.target.value }))} placeholder="https://instagram.com/…" /></Field>
          <Field label="TikTok"><input type="url" className="input" value={siteInfo.tiktok} onChange={(e) => setSiteInfo((s) => ({ ...s, tiktok: e.target.value }))} placeholder="https://tiktok.com/@…" /></Field>
          <Field label="Facebook"><input type="url" className="input" value={siteInfo.facebook} onChange={(e) => setSiteInfo((s) => ({ ...s, facebook: e.target.value }))} placeholder="https://facebook.com/…" /></Field>
          <Field label="WhatsApp"><input type="tel" className="input" value={siteInfo.whatsapp} onChange={(e) => setSiteInfo((s) => ({ ...s, whatsapp: e.target.value }))} placeholder="ex: 22479443" /></Field>
        </div>
        {siteStatus && <StatusLine status={siteStatus} />}
        <button disabled={siteBusy} className="btn-primary mt-5 inline-flex items-center gap-2 disabled:opacity-50"><Check size={16} /> {siteBusy ? 'Enregistrement…' : 'Enregistrer'}</button>
      </form>

      {/* Slides */}
      <section className="card mt-6 p-6">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-black"><Images size={18} className="text-brand-500" /> Slides du héros</h2>
        <p className="mb-4 text-sm text-ink-500">Gérez les slides du carousel (enregistrés avec « Enregistrer » des informations boutique).</p>
        <div className="space-y-4">
          {siteInfo.slides.map((slide, i) => (
            <div key={i} className="rounded-xl border border-ink-200 bg-sand-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-bold text-ink-900">Slide {i + 1}</span>
                <div className="flex items-center gap-1">
                  {i > 0 && <button type="button" onClick={() => setSiteInfo((p) => { const s = [...p.slides]; [s[i - 1], s[i]] = [s[i], s[i - 1]]; return { ...p, slides: s }; })} className="rounded-lg p-1.5 text-ink-700 hover:bg-ink-100"><MoveUp size={14} /></button>}
                  {i < siteInfo.slides.length - 1 && <button type="button" onClick={() => setSiteInfo((p) => { const s = [...p.slides]; [s[i], s[i + 1]] = [s[i + 1], s[i]]; return { ...p, slides: s }; })} className="rounded-lg p-1.5 text-ink-700 hover:bg-ink-100"><MoveDown size={14} /></button>}
                  <button type="button" onClick={() => setSiteInfo((p) => ({ ...p, slides: p.slides.filter((_, idx) => idx !== i) }))} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-700">Image</span>
                  <div className="flex items-center gap-3">
                    {slide.imageUrl && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={slide.imageUrl} alt="" className="h-16 w-16 flex-none rounded-lg border border-ink-200 object-cover" />
                    )}
                    <ImageUploader onUploaded={(img) => updateSlide(i, { imageUrl: img.url })} className="flex h-16 w-16 flex-none items-center justify-center rounded-lg border-2 border-dashed border-ink-200 bg-ink-100 text-[10px] font-bold text-ink-700 hover:border-brand-300">
                      <span className="flex flex-col items-center gap-0.5"><ImageIcon size={12} className="text-brand-500" /> {slide.imageUrl ? 'Changer' : 'Ajouter'}</span>
                    </ImageUploader>
                  </div>
                </div>
                <Field label="Titre"><input className="input" value={slide.title} onChange={(e) => updateSlide(i, { title: e.target.value })} placeholder="SHIRALY" /></Field>
                <Field label="Sous-titre"><input className="input" value={slide.subtitle} onChange={(e) => updateSlide(i, { subtitle: e.target.value })} placeholder="FROM ARTIST, TO ARTIST" /></Field>
                <Field label="Texte du bouton"><input className="input" value={slide.buttonText} onChange={(e) => updateSlide(i, { buttonText: e.target.value })} placeholder="SHOP NOW" /></Field>
                <Field label="Lien du bouton"><input className="input" value={slide.buttonLink} onChange={(e) => updateSlide(i, { buttonLink: e.target.value })} placeholder="/#products" /></Field>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setSiteInfo((p) => ({ ...p, slides: [...p.slides, { imageUrl: '', title: '', subtitle: '', buttonText: 'SHOP NOW', buttonLink: '/#products' }] }))} className="mt-4 inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-ink-300 px-4 py-3 text-sm font-bold text-ink-700 hover:bg-ink-100"><Plus size={16} /> Ajouter un slide</button>
      </section>

      <ConfirmDialog
        open={!!toDelete}
        danger
        busy={deleteBusy}
        title="Supprimer cet administrateur ?"
        message={toDelete ? `${toDelete.name} (${toDelete.email}) n'aura plus accès au tableau de bord.` : ''}
        confirmLabel="Supprimer"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

function StatusLine({ status }: { status: NonNullable<Status> }) {
  return (
    <p className={`mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${status.kind === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
      {status.kind === 'ok' ? <Check size={14} /> : <AlertCircle size={14} />} {status.msg}
    </p>
  );
}

function PasswordField({ label, value, onChange, show, onToggleShow, autoComplete }: {
  label: string; value: string; onChange: (v: string) => void; show: boolean; onToggleShow: () => void; autoComplete: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-700">{label}</span>
      <div className="relative">
        <input type={show ? 'text' : 'password'} className="input pr-12" value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required />
        <button type="button" onClick={onToggleShow} tabIndex={-1} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-ink-700 hover:bg-ink-100" aria-label={show ? 'Masquer' : 'Afficher'}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </label>
  );
}
