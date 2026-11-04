import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Job pages and the feed must render the full document on the first response
  // so Indeed and browsers with JavaScript off see the listing, not a shell.
  outputFileTracingIncludes: {
    "/feed.xml": ["./data/jobs.json"],
    "/jobs/[referencenumber]": ["./data/jobs.json"],
    "/jobs/closed/[referencenumber]": ["./data/jobs.json"],
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
