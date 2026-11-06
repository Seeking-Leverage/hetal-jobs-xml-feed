import type { NextConfig } from "next";

/**
 * Webflow Cloud mounts the app at /jobs and overwrites basePath from that mount.
 * Setting the same path here makes the local server match the public URLs.
 * Do not point the Webflow mount somewhere else without changing this.
 */
const rawMount = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "/jobs";
const basePath =
  rawMount === "/" || rawMount === ""
    ? ""
    : (rawMount.startsWith("/") ? rawMount : `/${rawMount}`).replace(/\/$/, "");

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  // Job pages and the feed must render the full document on the first response
  // so Indeed and browsers with JavaScript off see the listing, not a shell.
  outputFileTracingIncludes: {
    "/feed.xml": ["./data/jobs.json"],
    "/[referencenumber]": ["./data/jobs.json"],
    "/closed/[referencenumber]": ["./data/jobs.json"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
