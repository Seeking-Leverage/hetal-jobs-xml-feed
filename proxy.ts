import { NextResponse, type NextRequest } from "next/server";

import { JobsDataError } from "@/lib/config";
import { decodeReferencenumber, loadJobs } from "@/lib/jobs";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/jobs/closed/")) {
    if (request.nextUrl.searchParams.get("__closed") === "1") {
      return NextResponse.next();
    }
    const raw = pathname.slice("/jobs/closed/".length).split("/")[0] ?? "";
    const ref = decodeReferencenumber(raw);
    const url = request.nextUrl.clone();
    url.pathname = `/jobs/${encodeURIComponent(ref)}`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  const match = pathname.match(/^\/jobs\/([^/]+)$/);
  if (!match) return NextResponse.next();

  const ref = decodeReferencenumber(match[1] ?? "");
  try {
    const job = loadJobs().find((item) => item.referencenumber === ref);
    if (job?.status !== "closed") return NextResponse.next();

    const url = request.nextUrl.clone();
    url.pathname = `/jobs/closed/${encodeURIComponent(job.referencenumber)}`;
    url.searchParams.set("__closed", "1");
    return NextResponse.rewrite(url, { status: 410 });
  } catch (error) {
    if (error instanceof JobsDataError) return NextResponse.next();
    throw error;
  }
}

export const config = {
  matcher: ["/jobs/:path*"],
};
