const DEFAULT_COMPANY_NAME = "Hetal Retail";
const DEFAULT_FEED_EMAIL = "jobs@hetalretail.com";
const DEFAULT_ONELINK_BASE_URL = "https://hetal.onelink.me/placeholder";
const DEFAULT_SITE_URL = "http://127.0.0.1:43123";

export class JobsDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobsDataError";
  }
}

export function getCompanyName(): string {
  return process.env.COMPANY_NAME?.trim() || DEFAULT_COMPANY_NAME;
}

export function getFeedEmail(): string {
  const email = process.env.FEED_CONTACT_EMAIL?.trim() || DEFAULT_FEED_EMAIL;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new JobsDataError(
      `FEED_CONTACT_EMAIL is not a valid email address: ${email}`,
    );
  }
  return email;
}

export function getOnelinkBaseUrl(): string {
  const base = process.env.ONELINK_BASE_URL?.trim() || DEFAULT_ONELINK_BASE_URL;
  try {
    const url = new URL(base);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("unsupported protocol");
    }
    return url.toString();
  } catch {
    throw new JobsDataError(
      `ONELINK_BASE_URL must be an absolute http(s) URL. Received: ${base}`,
    );
  }
}

type HeaderSource = { get(name: string): string | null };

export function siteUrlFrom(
  headers: HeaderSource,
  fallbackOrigin?: string,
): string {
  const configured = process.env.SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const forwardedHost = headers.get("x-forwarded-host");
  const host = (forwardedHost ?? headers.get("host"))?.split(",")[0]?.trim();
  if (host) {
    const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const proto =
      forwardedProto ||
      (host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https");
    return `${proto}://${host}`;
  }

  if (fallbackOrigin) return fallbackOrigin.replace(/\/$/, "");
  return DEFAULT_SITE_URL;
}

export function getSiteUrl(request: Request): string {
  return siteUrlFrom(request.headers, new URL(request.url).origin);
}
