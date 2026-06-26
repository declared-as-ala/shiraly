'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Lock, Mail, ArrowRight, Sparkles } from 'lucide-react';

export default function Login() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <LoginForm />
    </Suspense>
  );
}

function LoadingShell() {
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-sand-100 via-sand-50 to-sand-100 p-4">
      <div className="h-96 w-full max-w-md animate-pulse rounded-3xl bg-white/60" />
    </div>
  );
}

function LoginForm() {
  const sp = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr('');
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password }),
    });
    const data = await res.json().catch(() => ({} as { role?: 'admin' | 'employee'; redirect?: string }));
    if (!res.ok) {
      setErr('Identifiants incorrects');
      setLoading(false);
      return;
    }

    const role = data.role as 'admin' | 'employee' | undefined;
    const home = role === 'employee' ? '/employee' : '/admin';

    const fromRaw = sp.get('from');
    const fromOk = fromRaw && (
      (role === 'admin' && fromRaw.startsWith('/admin')) ||
      (role === 'employee' && fromRaw.startsWith('/employee'))
    );
    const target = (fromOk && fromRaw) || data.redirect || home;

    window.location.assign(target);
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-gradient-to-br from-sand-100 via-sand-50 to-sand-100 p-4">
      {/* Decorative background elements */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:radial-gradient(circle_at_1px_1px,#3D2B1F_1px,transparent_0)] [background-size:24px_24px]" />
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-brand-100/40 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/4 h-64 w-64 -translate-x-1/2 rounded-full bg-brand-500/[0.04] blur-3xl" />

      <div className="relative flex w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-[0_32px_64px_-24px_rgba(61,43,31,0.2)]">
        {/* Left panel — brand showcase */}
        <div className="relative hidden w-1/2 bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 p-10 lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:radial-gradient(circle_at_1px_1px,#FDFBFA_1px,transparent_0)] [background-size:32px_32px]" />
          <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-brand-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-brand-400/10 blur-3xl" />

          <div className="relative">
            <Image src="/star-logo.svg" alt="Shiraly" width={48} height={48} className="h-10 w-auto" />
            <h1 className="font-heading mt-6 text-3xl font-black leading-tight text-sand-50">
              Shiraly<br />Console
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-sand-400">
              Gérez votre boutique de luxe tunisienne. Produits, commandes, catégories et plus encore.
            </p>
          </div>

          <div className="relative space-y-4">
            <div className="flex items-center gap-3 text-sm text-sand-300">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600/50 text-sand-50">
                <Sparkles size={14} />
              </span>
              <span>Collection Old Money</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-sand-300">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600/50 text-sand-50">
                <Sparkles size={14} />
              </span>
              <span>Livraison dans toute la Tunisie</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-sand-300">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600/50 text-sand-50">
                <Sparkles size={14} />
              </span>
              <span>Support client premium</span>
            </div>
          </div>

          <p className="relative text-xs text-sand-500">
            &copy; {new Date().getFullYear()} Shiraly. Luxe tunisien.
          </p>
        </div>

        {/* Right panel — login form */}
        <div className="flex w-full items-center justify-center px-6 py-12 sm:px-10 lg:w-1/2 lg:px-12">
          <form onSubmit={submit} className="w-full max-w-sm">
            {/* Mobile logo */}
            <div className="mb-8 text-center lg:hidden">
              <Image src="/star-logo.svg" alt="Shiraly" width={44} height={44} className="mx-auto h-10 w-auto brightness-0" />
              <h1 className="font-heading mt-4 text-2xl font-black text-ink-900">Shiraly Console</h1>
              <p className="mt-1 text-sm text-ink-500">Connectez-vous à votre compte</p>
            </div>

            {/* Desktop heading */}
            <div className="mb-8 hidden lg:block">
              <h2 className="font-heading text-2xl font-black text-ink-900">Bienvenue</h2>
              <p className="mt-1 text-sm text-ink-500">Connectez-vous pour accéder à la console.</p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-ink-700">Email</label>
                <span className="text-[10px] text-ink-400">(ou « admin »)</span>
                <div className="relative mt-1.5">
                  <Mail size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    type="text"
                    autoFocus
                    className="input h-12 pl-10 text-sm"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin ou employe@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-ink-700">Mot de passe</label>
                <input
                  type="password"
                  className="input mt-1.5 h-12 text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {err && (
              <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 ring-1 ring-red-200">
                {err}
              </div>
            )}

            <button
              disabled={loading}
              className="btn-primary mt-6 flex h-12 w-full items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="grid place-items-center">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-sand-50 border-t-transparent" />
                </span>
              ) : (
                <>Connexion <ArrowRight size={16} /></>
              )}
            </button>

            <p className="mt-6 text-center text-xs text-ink-400 lg:hidden">
              &copy; {new Date().getFullYear()} Shiraly
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
