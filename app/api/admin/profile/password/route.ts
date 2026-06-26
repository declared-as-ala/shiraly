import { NextResponse } from 'next/server';
import { isAdmin, getCurrentAdmin } from '@/lib/auth';
import { listAdmins, changeAdminPassword } from '@/lib/admin-users';

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const me = (await getCurrentAdmin()) ?? (await listAdmins())[0];
    if (!me?.id) return NextResponse.json({ error: 'Compte introuvable.' }, { status: 404 });
    const { currentPassword, newPassword, confirmPassword } = await req.json();
    if (!newPassword || newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'Les mots de passe ne correspondent pas.' }, { status: 400 });
    }
    await changeAdminPassword(me.id, String(currentPassword ?? ''), String(newPassword));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 400 });
  }
}
