import { NextResponse } from 'next/server';
import connect from '@/lib/mongodb';
import SiteSettingModel from '@/lib/models/SiteSetting';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connect();
    const doc = await SiteSettingModel.findOne({ key: 'hero_slides' }).lean();
    const slides = (doc?.value as Array<Record<string, unknown>>) ?? [];
    return NextResponse.json(slides);
  } catch {
    return NextResponse.json([]);
  }
}
