'use client';

import { useState } from 'react';
import { Mail, Check, ArrowRight } from 'lucide-react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Newsletter() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'error' | 'success'>('idle');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setStatus('error');
      return;
    }
    // No backend call — purely client-side confirmation (per scope).
    setStatus('success');
  }

  return (
    <section className="bg-sand-100 py-12 md:py-24">
      <div className="container-shop">
        <div className="mx-auto max-w-2xl rounded-3xl border border-ink-200 bg-white px-5 py-10 text-center shadow-card sm:px-6 md:px-12 md:py-12">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-brand-600">
            <Mail size={24} strokeWidth={1.6} />
          </span>
          <h2 className="font-heading mt-5 text-2xl font-black tracking-tight text-ink-900 md:text-3xl">
            JOIN THE SHIRALY WORLD
          </h2>
          <p className="mx-auto mt-3 max-w-md text-ink-500">
            Be the first to discover new drops, exclusive offers and curated looks.
          </p>

          {status === 'success' ? (
            <div className="mx-auto mt-8 flex max-w-md items-center justify-center gap-2 rounded-xl bg-brand-50 px-4 py-4 text-sm font-bold text-brand-700">
              <Check size={18} /> Welcome to Shiraly — check your inbox for the latest drops.
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="mx-auto mt-8 max-w-md">
              <div className="flex flex-col gap-3 sm:flex-row">
                <label htmlFor="newsletter-email" className="sr-only">Email</label>
                <input
                  id="newsletter-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (status === 'error') setStatus('idle');
                  }}
                  placeholder="votre@email.com"
                  aria-invalid={status === 'error'}
                  className={`input flex-1 ${status === 'error' ? 'border-red-400 focus:border-red-400 focus:ring-red-50' : ''}`}
                />
                <button type="submit" className="btn-cta shrink-0">
                  JOIN NOW <ArrowRight size={16} className="rtl:rotate-180" />
                </button>
              </div>
              {status === 'error' && (
                <p className="mt-2 text-start text-sm font-semibold text-red-600">
                  Veuillez saisir une adresse email valide.
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
