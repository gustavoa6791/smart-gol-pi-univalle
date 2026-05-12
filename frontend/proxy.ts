import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const authRoutes = ['/login', '/register'];
const publicExactRoutes = ['/'];

export function proxy(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value;
  const { pathname } = request.nextUrl;

  const isAuthRoute = authRoutes.some((r) => pathname.startsWith(r));
  const isLanding = publicExactRoutes.includes(pathname);

  if (!token && !isAuthRoute && !isLanding) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (token && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|api|hero|.*\\..*).*)'],
};
