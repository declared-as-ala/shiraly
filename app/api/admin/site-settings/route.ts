import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { getSiteSettings, setSiteSettings } from '@/lib/admin-storage';
import connect from '@/lib/mongodb';
import SiteSettingModel from '@/lib/models/SiteSetting';
import { SITE } from '@/lib/site-config';

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const saved = await getSiteSettings();
  let slides: Array<Record<string, unknown>> = [];
  try {
    await connect();
    const doc = await SiteSettingModel.findOne({ key: 'hero_slides' }).lean();
    slides = (doc?.value as Array<Record<string, unknown>>) ?? [];
  } catch {}
  return NextResponse.json({
    photoUrl: saved.photoUrl ?? SITE.logo,
    phones: saved.phones?.length ? saved.phones : [SITE.contact.phone],
    whatsapp: saved.whatsapp ?? SITE.contact.whatsapp,
    instagram: saved.instagram ?? SITE.contact.instagram,
    tiktok: saved.tiktok ?? SITE.contact.tiktok,
    facebook: saved.facebook ?? SITE.contact.facebook,
    slides,
  });
}

export async function PUT(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const patch: Parameters<typeof setSiteSettings>[0] = {};

    if (typeof body.photoUrl === 'string' || body.photoUrl === null) patch.photoUrl = body.photoUrl;
    if (Array.isArray(body.phones)) {
      patch.phones = (body.phones as unknown[])
        .map((p) => String(p).trim())
        .filter(Boolean);
    }
    if (typeof body.whatsapp === 'string') patch.whatsapp = body.whatsapp.trim();
    if (typeof body.instagram === 'string') patch.instagram = body.instagram.trim();
    if (typeof body.tiktok === 'string') patch.tiktok = body.tiktok.trim();
    if (typeof body.facebook === 'string') patch.facebook = body.facebook.trim();

    await setSiteSettings(patch);

    if (Array.isArray(body.slides)) {
      try {
        await connect();
        await SiteSettingModel.updateOne(
          { key: 'hero_slides' },
          { $set: { key: 'hero_slides', value: body.slides } },
          { upsert: true },
        );
      } catch {}
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
}
