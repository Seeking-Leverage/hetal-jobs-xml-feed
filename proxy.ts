import { NextResponse, type NextRequest } from "next/server";

import { JobsDataError } from "@/lib/config";
import { decodeReferencenumber, loadJobs } from "@/lib/jobs";

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const { pathname } = url;

  const legacy = pathname.match(/^(?:\/jobs)?\/jobs\/(HTL-[^/]+)$/);
  if (legacy) {
    url.pathname = `/${legacy[1]}`;
    url.search = "";
    return NextResponse.redirect(url, 308);
  }

  const closed = pathname.match(/^\/closed\/([^/]+)$/);
  if (closed) {
    if (url.searchParams.get("__closed") === "1") return NextResponse.next();
    url.pathname = `/${decodeReferencenumber(closed[1] ?? "")}`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  const match = pathname.match(/^\/(HTL-[^/]+)$/);
  if (!match) return NextResponse.next();

  const ref = decodeReferencenumber(match[1] ?? "");
  try {
    const job = loadJobs().find((item) => item.referencenumber === ref);
    if (job?.status !== "closed") return NextResponse.next();

    url.pathname = `/closed/${encodeURIComponent(job.referencenumber)}`;
    url.searchParams.set("__closed", "1");
    return NextResponse.rewrite(url, { status: 410 });
  } catch (error) {
    if (error instanceof JobsDataError) return NextResponse.next();
    throw error;
  }
}

export const config = {
  matcher: ["/HTL-:referencenumber", "/jobs/:referencenumber", "/jobs/jobs/:referencenumber", "/closed/:referencenumber"],
};
