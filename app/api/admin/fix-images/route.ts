import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * GET /api/admin/fix-images
 * Iterates ALL resources in the 'shiraly' Cloudinary folder and sets
 * access_mode to 'public' so they stop returning 401.
 * Run once after deployment.
 */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let fixed = 0;
  let failed = 0;
  let nextCursor: string | undefined;

  try {
    // Paginate through all resources in the shiraly folder
    do {
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: 'shiraly/',
        max_results: 100,
        ...(nextCursor ? { next_cursor: nextCursor } : {}),
      });

      for (const resource of result.resources as Array<{ public_id: string; access_mode?: string }>) {
        // Only update if not already public
        if (resource.access_mode === 'public') {
          fixed++; // count as already good
          continue;
        }
        try {
          await cloudinary.api.update(resource.public_id, {
            access_mode: 'public',
          });
          fixed++;
        } catch (err) {
          console.error('[fix-images] failed for', resource.public_id, err);
          failed++;
        }
      }

      nextCursor = result.next_cursor;
    } while (nextCursor);

    return NextResponse.json({
      ok: true,
      message: `Done. ${fixed} images set to public, ${failed} failed.`,
      fixed,
      failed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
