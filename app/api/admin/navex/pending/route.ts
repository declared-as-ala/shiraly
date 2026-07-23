import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { navex } from '@/lib/navex';

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const result = await navex.getPending();
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
