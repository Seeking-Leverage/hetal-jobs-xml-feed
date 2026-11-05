import { COMPANY_SITE_URL, getCompanyName } from "../lib/config";
import { loadLocalEnv } from "../lib/env-file";
import { formatLongDate } from "../lib/format";
import { jobPostingIssues } from "../lib/jsonld";
import { loadJobs } from "../lib/jobs";
import type { Job } from "../lib/types";
import { jobCanonicalUrl, sitemapJobUrls } from "../lib/urls";

const passes: string[] = [];
const failures: string[] = [];

function ok(message: string) {
  passes.push(message);
}

function fail(message: string) {
  failures.push(message);
}

function decodeHtml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function jsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  for (const match of html.matchAll(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    blocks.push(JSON.parse(match[1]));
  }
  return blocks;
}

function canonicalHref(html: string): string | undefined {
  const match = html.match(/<link[^>]*rel="canonical"[^>]*>/i);
  return match?.[0].match(/href="([^"]+)"/)?.[1];
}

async function main() {
  loadLocalEnv();
  const base = (process.env.VALIDATE_BASE_URL ?? "http://127.0.0.1:43123").replace(/\/$/, "");
  const jobs = loadJobs();
  const open = jobs.filter((job) => job.status === "open");
  const closed = jobs.filter((job) => job.status === "closed");
  const company = getCompanyName();

  for (const job of open) {
    const issues = jobPostingIssues(job, base);
    if (issues.length > 0) fail(`${job.referencenumber}: ${issues.join("; ")}`);
  }
  if (failures.length === 0) ok(`${open.length} open jobs pass the local JobPosting checks`);

  const expectedUrls = new Set(sitemapJobUrls(jobs, base));
  if (expectedUrls.size !== open.length) fail("sitemap helper dropped or duplicated an open job");
  for (const job of closed) {
    if ([...expectedUrls].some((url) => url.includes(job.referencenumber))) {
      fail(`sitemap helper includes closed job ${job.referencenumber}`);
    }
  }

  const sitemap = await fetch(`${base}/sitemap.xml`, { signal: AbortSignal.timeout(15000) });
  const sitemapXml = await sitemap.text();
  if (sitemap.status !== 200) fail(`/sitemap.xml returned ${sitemap.status}`);
  const locs = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
    decodeHtml(match[1]),
  );
  const jobLocs = locs.filter((loc) => loc.includes("/jobs/"));
  if (jobLocs.length !== open.length) {
    fail(`sitemap lists ${jobLocs.length} job URLs, expected ${open.length}`);
  } else {
    ok("sitemap lists only the open job URLs");
  }
  for (const job of open) {
    const canonical = jobCanonicalUrl(base, job.referencenumber);
    if (!locs.includes(canonical)) fail(`sitemap is missing ${canonical}`);
  }
  for (const job of closed) {
    if (sitemapXml.includes(job.referencenumber)) {
      fail(`sitemap includes closed job ${job.referencenumber}`);
    }
  }
  if (locs.some((loc) => loc.includes("?"))) fail("sitemap job URL contains a query string");

  const home = await fetch(base, { signal: AbortSignal.timeout(15000) });
  const homeHtml = await home.text();
  if (jsonLdBlocks(homeHtml).some((block) => JSON.stringify(block).includes("JobPosting"))) {
    fail("the job list page includes JobPosting structured data");
  } else {
    ok("the job list page has no JobPosting structured data");
  }

  const failuresBeforePages = failures.length;
  for (const job of open) {
    await checkOpenPage(base, job, company);
  }
  if (open[0]) await checkChannelCanonical(base, open[0]);
  if (failures.length === failuresBeforePages) {
    ok("open job pages expose one JobPosting and the canonical referencenumber URL");
  }

  for (const job of closed) {
    const response = await fetch(`${base}/jobs/${encodeURIComponent(job.referencenumber)}`, {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    const html = await response.text();
    if (response.status !== 410) {
      fail(`${job.referencenumber} returned ${response.status}, expected 410`);
      continue;
    }
    const postings = jsonLdBlocks(html).filter((block) => JSON.stringify(block).includes("JobPosting"));
    if (postings.length > 0) fail(`${job.referencenumber} 410 page still includes JobPosting`);
    else ok(`${job.referencenumber} returns 410 without JobPosting`);
  }
  if (closed.length === 0) ok("no closed jobs are in data/jobs.json");

  if (failures.length > 0) {
    for (const message of failures) console.error(`not ok  ${message}`);
    console.error(`${failures.length} checks failed.`);
    process.exitCode = 1;
    return;
  }
  for (const message of passes) console.log(`ok  ${message}`);
  console.log(`${passes.length} checks passed.`);
}

async function checkOpenPage(base: string, job: Job, company: string) {
  const canonical = jobCanonicalUrl(base, job.referencenumber);
  const response = await fetch(canonical, { redirect: "manual", signal: AbortSignal.timeout(15000) });
  const html = await response.text();
  if (response.status !== 200) {
    fail(`${job.referencenumber} page returned ${response.status}`);
    return;
  }
  const blocks = jsonLdBlocks(html).filter((block) => {
    const record = block as { "@type"?: string };
    return record["@type"] === "JobPosting";
  });
  if (blocks.length !== 1) {
    fail(`${job.referencenumber} page has ${blocks.length} JobPosting blocks`);
    return;
  }
  const schema = blocks[0] as {
    title?: string;
    description?: string;
    datePosted?: string;
    validThrough?: string;
    url?: string;
    hiringOrganization?: { name?: string };
    jobLocation?: { address?: { addressLocality?: string; addressRegion?: string; postalCode?: string } };
  };
  if (schema.title !== job.title) fail(`${job.referencenumber} JSON-LD title does not match the job`);
  if (schema.description !== job.description_html) {
    fail(`${job.referencenumber} JSON-LD description does not match the page copy`);
  }
  if (schema.datePosted !== job.date_posted) fail(`${job.referencenumber} JSON-LD datePosted does not match`);
  if (schema.url !== canonical) fail(`${job.referencenumber} JSON-LD url is not the canonical URL`);
  if (schema.hiringOrganization?.name !== company) {
    fail(`${job.referencenumber} hiring organization is not ${company}`);
  }
  const address = schema.jobLocation?.address;
  if (
    address?.addressLocality !== job.city ||
    address?.addressRegion !== job.state ||
    address?.postalCode !== job.postalcode
  ) {
    fail(`${job.referencenumber} JSON-LD location does not match the job`);
  }
  if (job.valid_through && !schema.validThrough?.startsWith(job.valid_through)) {
    fail(`${job.referencenumber} JSON-LD is missing validThrough`);
  }
  const link = canonicalHref(html);
  if (link !== canonical) fail(`${job.referencenumber} canonical link is ${link ?? "missing"}`);
  const visible = [
    job.title,
    job.pay,
    job.city,
    job.state,
    job.postalcode,
    job.description_html,
    company,
    COMPANY_SITE_URL,
    `Posted ${formatLongDate(job.date_posted)}`,
    job.referencenumber,
  ];
  if (job.valid_through) visible.push(`Open through ${formatLongDate(job.valid_through)}`);
  for (const snippet of visible) {
    if (!html.includes(snippet)) fail(`${job.referencenumber} page is missing ${JSON.stringify(snippet.slice(0, 80))}`);
  }
}

async function checkChannelCanonical(base: string, job: Job) {
  const canonical = jobCanonicalUrl(base, job.referencenumber);
  const response = await fetch(`${canonical}?channel=adzuna`, {
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  const html = await response.text();
  const link = canonicalHref(html);
  if (response.status !== 200 || link !== canonical) {
    fail(`${job.referencenumber} channel URL changed the canonical (${link ?? "missing"})`);
  } else {
    ok("a channel query keeps the permanent canonical URL");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
