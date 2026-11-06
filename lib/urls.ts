/** Webflow Cloud mounts this app at /jobs on www.hetalretail.com. */
export const MOUNT_PATH = "/jobs";
export const PUBLIC_SITE_ORIGIN = "https://www.hetalretail.com";

const PRIVATE_HOST = /^(127\.0\.0\.1|localhost|0\.0\.0\.0)$/i;
const NON_PUBLIC_HOST = /\.vercel\.app$/i;

export function mountPath(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || MOUNT_PATH;
  if (raw === "/" || raw === "") return "";
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return path.replace(/\/$/, "");
}

function blockedHost(hostname: string): boolean {
  return PRIVATE_HOST.test(hostname) || NON_PUBLIC_HOST.test(hostname);
}

/**
 * Origin used in feeds, the sitemap, and canonical job URLs.
 * Production never publishes localhost or a vercel.app host.
 */
export function publicSiteOrigin(candidate?: string, production = process.env.NODE_ENV === "production"): string {
  const configured = process.env.SITE_URL?.trim();
  const raw = production ? configured || "" : configured || candidate || "";
  if (raw) {
    try {
      const url = new URL(raw);
      if (!production || (url.protocol === "https:" && !blockedHost(url.hostname))) {
        return url.origin;
      }
    } catch {
      // Fall through to the default origin.
    }
  }
  return production ? PUBLIC_SITE_ORIGIN : "http://127.0.0.1:43123";
}

/** App route. Next.js adds the /jobs base path on its own. */
export function jobPath(referencenumber: string): string {
  return `/${encodeURIComponent(referencenumber)}`;
}

/** Permanent public URL for one visit. No channel or source query. */
export function jobCanonicalUrl(
  siteUrl: string,
  referencenumber: string,
  production?: boolean,
): string {
  return `${publicSiteOrigin(siteUrl, production)}${mountPath()}/${encodeURIComponent(referencenumber)}`;
}

export function jobsHomeUrl(siteUrl?: string): string {
  return `${publicSiteOrigin(siteUrl)}${mountPath()}`;
}

export function sitemapJobUrls(
  jobs: Array<{ status: string; referencenumber: string }>,
  origin: string,
): string[] {
  return jobs
    .filter((job) => job.status === "open")
    .map((job) => jobCanonicalUrl(origin, job.referencenumber));
}

