import { NextResponse } from 'next/server';
import { isAdmin, getCurrentAdmin } from '@/lib/auth';
import { listAdmins, updateAdminProfile, type AdminUser } from '@/lib/admin-users';

/** Resolve the editable admin account for the session (falls back to the first admin). */
async function resolveSelf(): Promise<AdminUser | null> {
  const me = await getCurrentAdmin();
  if (me) return me;
  const all = await listAdmins().catch(() => []);
  return all[0] ?? null;
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const me = await resolveSelf();
  if (!me) {
    return NextResponse.json({ id: null, name: 'Administrateur', email: '', avatarUrl: null, role: 'admin', createdAt: null });
  }
  return NextResponse.json(me);
}

export async function PUT(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const me = await resolveSelf();
    if (!me?.id) return NextResponse.json({ error: 'Compte introuvable.' }, { status: 404 });
    const body = await req.json();
    const patch: { name?: string; email?: string; avatarUrl?: string | null } = {};
    if (typeof body.name === 'string') patch.name = body.name;
    if (typeof body.email === 'string') patch.email = body.email;
    if (typeof body.avatarUrl === 'string' || body.avatarUrl === null) patch.avatarUrl = body.avatarUrl;
    const updated = await updateAdminProfile(me.id, patch);
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 400 });
  }
}
