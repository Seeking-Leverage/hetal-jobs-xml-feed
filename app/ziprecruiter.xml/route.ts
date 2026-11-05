import { NextResponse } from "next/server";

import { JobsDataError, getSiteUrl } from "@/lib/config";
import { buildZipRecruiterFeedXml } from "@/lib/feed";
import { loadJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const xml = buildZipRecruiterFeedXml(loadJobs(), getSiteUrl(request));
    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof JobsDataError
        ? error.message
        : "Could not build the ZipRecruiter feed.";
    return new NextResponse(message, {
      status: 500,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
}