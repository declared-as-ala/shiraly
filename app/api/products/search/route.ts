import { NextResponse } from 'next/server';
import connect from '@/lib/mongodb';
import ProductModel from '@/lib/models/Product';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  await connect();
  const docs = await ProductModel.find({
    status: 'published',
    name: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
  })
    .select('name slug regularPrice salePrice images')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const results = docs.map((d: Record<string, unknown>) => ({
    id: String(d._id),
    name: d.name as string,
    slug: d.slug as string,
    price: (d.salePrice ?? d.regularPrice) as number,
    regularPrice: d.regularPrice as number,
    image: ((d.images as Array<{ url: string }>)?.[0]?.url) ?? null,
  }));

  return NextResponse.json(results);
}
