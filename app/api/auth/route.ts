import { NextResponse } from 'next/server';
import { COOKIE, LEGACY_COOKIE, signSession } from '@/lib/auth';
import { verifyPassword as verifyAdminPassword } from '@/lib/admin-storage';
import { verifyAdminCredentials, ensureBootstrapAdmin, isEmail } from '@/lib/admin-users';

function setSessionCookie(res: NextResponse, value: string) {
  res.cookies.set(COOKIE, value, {
    httpOnly: true, sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 7,
  });
  res.cookies.set(LEGACY_COOKIE, '', { maxAge: 0, path: '/' });
}

export async function POST(req: Request) {
  let body: { username?: string; email?: string; password?: string } = {};
  try { body = await req.json(); } catch { /* keep empty */ }
  const password = String(body.password ?? '');
  const usernameRaw = String(body.username ?? body.email ?? '').trim();
  const isLegacyAdmin = !usernameRaw || usernameRaw.toLowerCase() === 'admin';

  // 1) Multi-user admin: email matches a stored AdminUser
  if (!isLegacyAdmin && isEmail(usernameRaw)) {
    const adminUser = await verifyAdminCredentials(usernameRaw, password).catch(() => null);
    if (adminUser) {
      const res = NextResponse.json({ ok: true, role: 'admin', redirect: '/admin' });
      setSessionCookie(res, signSession({ role: 'admin', userId: adminUser.id, name: adminUser.name }));
      return res;
    }
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // 2) Legacy admin bootstrap
  if (isLegacyAdmin) {
    const ok = await verifyAdminPassword(password);
    if (!ok) return NextResponse.json({ ok: false }, { status: 401 });
    let userId = 'admin';
    let name = 'Administrateur';
    try {
      const bootstrap = await ensureBootstrapAdmin(password);
      userId = bootstrap.id;
      name = bootstrap.name;
    } catch { /* DB unavailable — fall back to legacy synthetic admin */ }
    const res = NextResponse.json({ ok: true, role: 'admin', redirect: '/admin' });
    setSessionCookie(res, signSession({ role: 'admin', userId, name }));
    return res;
  }

  return NextResponse.json({ ok: false }, { status: 401 });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, '', { maxAge: 0, path: '/' });
  res.cookies.set(LEGACY_COOKIE, '', { maxAge: 0, path: '/' });
  return res;
}
