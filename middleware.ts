import { NextResponse, type NextRequest } from "next/server";

import closedRefs from "./data/closed-refs.json";
import { closedJobRewrite, decodeReferencenumber } from "./lib/closed";

const closed = new Set(closedRefs);

/**
 * Edge middleware. Next.js 16 proxy.ts runs as Node middleware on Webflow Cloud
 * and crashes on a Cookie header (`undefined.parse`). This file stays on Edge
 * and only consults the closed-reference list, not data/jobs.json.
 */
export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const { pathname } = url;

  const legacy = pathname.match(/^(?:\/jobs)?\/jobs\/(HTL-[^/]+)$/);
  if (legacy) {
    url.pathname = `/${legacy[1]}`;
    url.search = "";
    return NextResponse.redirect(url, 308);
  }

  const closedPath = pathname.match(/^\/closed\/([^/]+)$/);
  if (closedPath) {
    if (url.searchParams.get("__closed") === "1") return NextResponse.next();
    url.pathname = `/${decodeReferencenumber(closedPath[1] ?? "")}`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  const rewrite = closedJobRewrite(pathname, url.search, closed);
  if (!rewrite) return NextResponse.next();
  const target = new URL(rewrite, "https://www.hetalretail.com");
  url.pathname = target.pathname;
  url.search = target.search;
  return NextResponse.rewrite(url, { status: 410 });
}

export const config = {
  matcher: ["/HTL-:referencenumber", "/jobs/:referencenumber", "/jobs/jobs/:referencenumber", "/closed/:referencenumber"],
};
