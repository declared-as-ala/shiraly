import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COOKIE, LEGACY_COOKIE, cookieLooksValid } from '@/lib/auth-shared';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith('/admin') || pathname === '/admin-login') {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(COOKIE)?.value;
  if (cookieLooksValid(sessionCookie)) return NextResponse.next();

  const legacy = request.cookies.get(LEGACY_COOKIE)?.value;
  if (cookieLooksValid(legacy)) return NextResponse.next();

  const url = new URL('/admin-login', request.url);
  url.searchParams.set('from', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: '/admin/:path*',
};
