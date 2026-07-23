import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { navex } from '@/lib/navex';

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const codes = Array.isArray(body.codes)
    ? body.codes
    : String(body.codes ?? '').split(',');
  const result = await navex.getMultipleStates(codes);
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
