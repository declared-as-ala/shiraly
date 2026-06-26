// Server-safe presentational kit (no 'use client') so server components like the
// dashboard can pass icon components as props. The only interactive piece,
// ConfirmDialog, lives in its own client module and is re-exported below.
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

export { ConfirmDialog } from './ConfirmDialog';

/* ── Page header with breadcrumbs ──────────────────────────────────── */
export function PageHeader({
  title, subtitle, breadcrumbs, actions,
}: {
  title: string;
  subtitle?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="mb-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-ink-500">
            {breadcrumbs.map((b, i) => (
              <span key={`${b.label}-${i}`} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-ink-300">/</span>}
                {b.href ? <a href={b.href} className="hover:text-brand-600">{b.label}</a> : <span>{b.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="font-heading text-2xl font-black text-ink-900 md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ── Metric card ───────────────────────────────────────────────────── */
export function MetricCard({
  label, value, icon: Icon, accent = false, hint,
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  accent?: boolean;
  hint?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-5 shadow-card ${
        accent ? 'bg-gradient-to-br from-brand-600 to-brand-800 text-sand-50' : 'border border-ink-200 bg-white text-ink-900'
      }`}
    >
      <div className="flex items-start justify-between">
        <p className={`text-xs font-bold uppercase tracking-wide ${accent ? 'text-sand-50/80' : 'text-ink-500'}`}>{label}</p>
        {Icon && <Icon size={20} className={accent ? 'text-sand-50/50' : 'text-brand-400'} />}
      </div>
      <p className="mt-3 text-3xl font-black">{value}</p>
      {hint && <p className={`mt-1 text-xs ${accent ? 'text-sand-50/70' : 'text-ink-500'}`}>{hint}</p>}
    </div>
  );
}

/* ── Status badge ──────────────────────────────────────────────────── */
export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
const TONE: Record<BadgeTone, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-blue-50 text-blue-700 ring-blue-200',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
};
export function StatusBadge({ tone = 'neutral', children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${TONE[tone]}`}>
      {children}
    </span>
  );
}

/* ── Empty state ───────────────────────────────────────────────────── */
export function EmptyState({
  icon: Icon = Inbox, title, description, action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-ink-200 bg-white px-6 py-12 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-sand-200 text-brand-500"><Icon size={26} /></span>
      <p className="font-bold text-ink-900">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-500">{description}</p>}
      {action}
    </div>
  );
}

/* ── Loading skeleton ──────────────────────────────────────────────── */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-ink-100 ${className}`} />;
}

/* ── Form field wrapper ────────────────────────────────────────────── */
export function Field({
  label, htmlFor, hint, error, children, className = '',
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-700">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-semibold text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-ink-500">{hint}</span>
      ) : null}
    </label>
  );
}
