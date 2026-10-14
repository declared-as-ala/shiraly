import { NextResponse } from 'next/server';
import { getProductImageSource } from '@/services/mongo/mongo-product-service';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string; kind: string; idx: string } }) {
  const { id, kind, idx } = params;
  if (!/^[a-f0-9]{24}$/.test(id) || !/^(i|h|b)$/.test(kind) || !/^\d{1,3}$/.test(idx)) {
    return new NextResponse('Not found', { status: 404 });
  }
  const src = await getProductImageSource(id, kind, Number(idx));
  if (!src) return new NextResponse('Not found', { status: 404 });

  const m = /^data:([^;,]+);base64,(.*)$/s.exec(src);
  if (!m) return NextResponse.redirect(src, 302);
  return new NextResponse(Buffer.from(m[2], 'base64'), {
    headers: {
      'Content-Type': m[1],
      'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
