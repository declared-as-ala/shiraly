import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { orderService } from '@/services';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const o = await orderService.getById(id);
  return o ? NextResponse.json(o) : NextResponse.json({ error: 'not found' }, { status: 404 });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const body = await req.json();
    const order = await orderService.update(id, body);
    return NextResponse.json(order);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'update failed' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    // ?permanent=1 (or deleting an order already in the trash) → hard delete.
    // Otherwise soft-delete: move the order to the "Supprimées" (trash) tab so it
    // stays recoverable, matching the WooCommerce-style UI.
    const permanent = new URL(req.url).searchParams.get('permanent') === '1';
    const existing = await orderService.getById(id).catch(() => null);

    if (permanent || existing?.status === 'trash') {
      await orderService.remove(id);
      return NextResponse.json({ ok: true, permanentlyDeleted: true });
    }

    if (!existing) return NextResponse.json({ ok: true, alreadyDeleted: true });

    await orderService.update(id, { status: 'trash' });
    return NextResponse.json({ ok: true, trashed: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'delete failed';
    if (/\b404\b/.test(msg) || /invalid_id/i.test(msg)) {
      return NextResponse.json({ ok: true, alreadyDeleted: true });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
