/**
 * Server-side auth: HMAC-verified session cookies.
 * Uses Node.js crypto (not available in Edge/middleware).
 */
import { cookies } from 'next/headers';
import crypto from 'crypto';
export { COOKIE, LEGACY_COOKIE, type Role, type Session } from './auth-shared';
import { COOKIE, LEGACY_COOKIE, type Session } from './auth-shared';

const SECRET = process.env.SESSION_SECRET ?? 'change-me';

function hmac(value: string): string {
  return crypto.createHmac('sha256', SECRET).update(value).digest('hex');
}

export function sign(value: string): string {
  return `${value}.${hmac(value)}`;
}

export function verify(signed: string | undefined): string | null {
  if (!signed) return null;
  const i = signed.lastIndexOf('.');
  if (i < 0) return null;
  const value = signed.slice(0, i);
  const sig = signed.slice(i + 1);
  const expected = hmac(value);
  const A = Buffer.from(sig);
  const B = Buffer.from(expected);
  if (A.length !== B.length) return null;
  return crypto.timingSafeEqual(A, B) ? value : null;
}

export function signSession(s: Session): string {
  return sign(JSON.stringify(s));
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const sessionCookie = store.get(COOKIE)?.value;
  const verified = verify(sessionCookie);
  if (verified) {
    try {
      const parsed = JSON.parse(verified) as Session;
      if (parsed && (parsed.role === 'admin' || parsed.role === 'employee') && parsed.userId) return parsed;
    } catch { /* fall through */ }
  }
  const legacy = store.get(LEGACY_COOKIE)?.value;
  if (verify(legacy) === 'admin') {
    return { role: 'admin', userId: 'admin', name: 'admin' };
  }
  return null;
}

export async function isAdmin(): Promise<boolean> {
  return (await getSession())?.role === 'admin';
}

export async function currentUserId(): Promise<string | null> {
  return (await getSession())?.userId ?? null;
}

export async function getCurrentAdmin() {
  const session = await getSession();
  if (!session || session.role !== 'admin') return null;
  const { getAdminById } = await import('@/lib/admin-users');
  return getAdminById(session.userId);
}
