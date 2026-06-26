import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { orderService } from '@/services';

/**
 * Returns the unique status slugs currently used in the store, so the order
 * drawer always shows valid options — works even on custom-status plugins.
 * Standard WC statuses are appended as fallback.
 */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const res = await orderService.list({ perPage: 100 });
    const found = Array.from(new Set(res.items.map((o) => String(o.status)))).filter(Boolean);
    const fallback = ['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed'];
    const merged = Array.from(new Set([...found, ...fallback]));
    return NextResponse.json(merged);
  } catch {
    return NextResponse.json([
      'pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed',
    ]);
  }
}
