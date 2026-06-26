import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { listAdmins, createAdmin } from '@/lib/admin-users';

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const users = await listAdmins().catch(() => []);
  return NextResponse.json(users);
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const { name, email, password, avatarUrl } = await req.json();
    const user = await createAdmin({ name: String(name ?? ''), email: String(email ?? ''), password: String(password ?? ''), avatarUrl: avatarUrl ?? null });
    return NextResponse.json(user);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 400 });
  }
}
