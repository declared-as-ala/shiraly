import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { orderService } from '@/services';

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const phone = url.searchParams.get('phone')?.trim();
  if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 });

  // WC REST has no first-class phone filter, so we use generic search.
  // For a low-volume Tunisian store this is fine; replace with custom DB in Phase 2.
  const res = await orderService.list({ perPage: 50, search: phone }).catch(() => ({
    items: [], total: 0, totalPages: 0, page: 1,
  }));
  const matches = res.items.filter((o) => (o.customer.phone || '').replace(/\s/g, '') === phone.replace(/\s/g, ''));

  return NextResponse.json({
    total: matches.length,
    orders: matches.map((o) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      total: o.total,
      createdAt: o.createdAt,
      itemsCount: o.items.reduce((s, i) => s + i.quantity, 0),
      thumbnails: o.items.map((i) => i.imageUrl).filter(Boolean).slice(0, 4),
    })),
  });
}
