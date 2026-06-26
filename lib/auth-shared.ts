/**
 * Constants + lightweight cookie check for middleware.
 * Full HMAC verification (Node crypto) lives in auth.ts.
 */
export const COOKIE = 'shiraly_session';
export const LEGACY_COOKIE = 'shiraly_admin';

export type Role = 'admin' | 'employee';

/** Middleware-safe: checks cookie format without Node crypto. */
export function cookieLooksValid(signed: string | undefined): boolean {
  if (!signed) return false;
  const i = signed.lastIndexOf('.');
  if (i < 0) return false;
  const value = signed.slice(0, i);
  if (value === 'admin') return true; // legacy cookie
  try {
    const p = JSON.parse(value);
    return (p.role === 'admin' || p.role === 'employee') && !!p.userId;
  } catch { return false; }
}
