import { NextRequest, NextResponse } from "next/server";

/* Layouts can't read the pathname or query string, but a site-wide drop lock
   has to be enforced above the page — several public pages are client
   components and can't check it themselves. So this forwards both to the root
   layout as headers and lets it decide. Nothing else happens here; keeping the
   middleware trivial keeps it off the request's critical path. */

export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname);
  headers.set("x-search", req.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Skip static assets and API routes — they never render the lock.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|site|.*\\.).*)"],
};
