import fs from "node:fs";
import path from "node:path";

import { XMLValidator } from "fast-xml-parser";

import { getCompanyName, getFeedEmail } from "../lib/config";
import { loadJobs } from "../lib/jobs";
import type { Job } from "../lib/types";

const JOB_TAGS = [
  "title",
  "date",
  "referencenumber",
  "requisitionid",
  "url",
  "company",
  "city",
  "state",
  "country",
  "postalcode",
  "email",
  "description",
  "jobtype",
  "salary",
] as const;

const ENTITY = /&(?:#\d+|#x[0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]+);/;

const passes: string[] = [];
const failures: string[] = [];

function ok(message: string) {
  passes.push(message);
}

function fail(message: string) {
  failures.push(message);
}

function loadEnvFile(filename: string) {
  const file = path.join(process.cwd(), filename);
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function cdataField(block: string, tag: string): string | undefined {
  const match = block.match(
    new RegExp(`<${tag}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`),
  );
  return match ? match[1] : undefined;
}

function decodeHtml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'");
}

function h1Text(html: string): string {
  const match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (!match) return "";
  return decodeHtml(match[1].replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function report() {
  for (const line of passes) console.log(`ok  ${line}`);
  for (const line of failures) console.error(`fail  ${line}`);
  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed.`);
    process.exitCode = 1;
    return;
  }
  console.log(`\n${passes.length} checks passed.`);
}

async function main() {
  loadEnvFile(".env");
  loadEnvFile(".env.local");

  const base = (process.env.VALIDATE_BASE_URL ?? "http://127.0.0.1:43123").replace(
    /\/$/,
    "",
  );

  let jobs: Job[];
  try {
    jobs = loadJobs();
    ok(`read ${jobs.length} jobs from data/jobs.json`);
  } catch (error) {
    fail(error instanceof Error ? error.message : "Could not read data/jobs.json");
    report();
    return;
  }

  const open = jobs.filter((job) => job.status === "open");
  const closed = jobs.filter((job) => job.status === "closed");
  ok(`${open.length} open and ${closed.length} closed in data/jobs.json`);

  let response: Response;
  try {
    response = await fetch(`${base}/feed.xml`, {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    fail(
      `Could not fetch ${base}/feed.xml. Start the app with npm run dev. ${
        error instanceof Error ? error.message : ""
      }`.trim(),
    );
    report();
    return;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/xml")) {
    fail(`Content-Type must include application/xml, received "${contentType || "missing"}"`);
  } else {
    ok(`Content-Type ${contentType}`);
  }
  if (response.status !== 200) fail(`/feed.xml returned ${response.status}, expected 200`);

  const xml = await response.text();
  if (!xml.startsWith("<?xml")) fail("feed is missing the XML declaration");

  const wellFormed = XMLValidator.validate(xml);
  if (wellFormed !== true) {
    fail(
      `XML is not well formed: ${wellFormed.err.msg} (line ${wellFormed.err.line})`,
    );
  } else {
    ok("XML is well formed");
  }

  if (ENTITY.test(xml)) {
    fail("feed contains an HTML entity; text fields must use literal characters inside CDATA");
  } else {
    ok("feed has no HTML entities");
  }

  const withoutJobs = xml.replace(/<job>[\s\S]*?<\/job>/g, "");
  for (const tag of ["publisher", "publisherurl"] as const) {
    const value = cdataField(withoutJobs, tag);
    if (!value?.trim()) fail(`<${tag}> must be present and wrapped in CDATA`);
    else ok(`<${tag}> is wrapped in CDATA`);
  }

  const company = getCompanyName();
  const email = getFeedEmail();
  const publisher = cdataField(withoutJobs, "publisher");
  if (publisher !== company) {
    fail(`publisher is ${JSON.stringify(publisher)}, expected ${JSON.stringify(company)}`);
  }
  const publisherUrl = cdataField(withoutJobs, "publisherurl");
  if (publisherUrl && !/^https?:\/\//.test(publisherUrl)) {
    fail(`publisherurl must be an absolute URL, received ${publisherUrl}`);
  }

  const blocks = [...xml.matchAll(/<job>([\s\S]*?)<\/job>/g)].map((match) => match[1]);
  if (blocks.length !== open.length) {
    fail(`feed has ${blocks.length} <job> nodes, jobs.json has ${open.length} open jobs`);
  } else {
    ok("feed includes every open job and no extra jobs");
  }

  const rows: Array<Record<string, string>> = [];
  for (const [index, block] of blocks.entries()) {
    const row: Record<string, string> = {};
    for (const tag of JOB_TAGS) {
      const value = cdataField(block, tag);
      if (value === undefined) {
        fail(`job ${index + 1} is missing a CDATA <${tag}>`);
        continue;
      }
      if (value.trim() === "") fail(`job ${index + 1} <${tag}> is empty`);
      row[tag] = value;
    }
    if (JOB_TAGS.every((tag) => row[tag] !== undefined)) rows.push(row);
  }

  const refs = rows.map((row) => row.referencenumber);
  if (new Set(refs).size !== refs.length) fail("referencenumbers in the feed are not unique");
  else if (refs.length > 0) ok("referencenumbers are unique");

  for (const job of closed) {
    if (xml.includes(`<![CDATA[${job.referencenumber}]]>`)) {
      fail(`closed job ${job.referencenumber} is still in the feed`);
    } else {
      ok(`closed job ${job.referencenumber} is left out of the feed`);
    }
  }

  const byRef = new Map(rows.map((row) => [row.referencenumber, row]));
  for (const job of open) {
    const row = byRef.get(job.referencenumber);
    if (!row) {
      fail(`open job ${job.referencenumber} is missing from the feed`);
      continue;
    }

    if (!/^\d{5}$/.test(row.postalcode)) {
      fail(`${job.referencenumber} postalcode must be 5 digits, received ${row.postalcode}`);
    } else if (row.postalcode !== job.postalcode) {
      fail(
        `${job.referencenumber} postalcode ${row.postalcode} does not match jobs.json ${job.postalcode}`,
      );
    } else {
      ok(`${job.referencenumber} ZIP ${row.postalcode}`);
    }

    const expected: Record<string, string> = {
      title: job.title,
      date: job.date_posted,
      referencenumber: job.referencenumber,
      requisitionid: job.requisitionid,
      company,
      city: job.city,
      state: job.state,
      country: job.country,
      email,
      description: job.description_html,
      jobtype: job.jobtype,
      salary: job.pay,
    };
    for (const [field, value] of Object.entries(expected)) {
      if (row[field] !== value) {
        fail(`${job.referencenumber} <${field}> does not match jobs.json`);
      }
    }
    if (!row.description?.includes("<") || row.description.includes("&lt;")) {
      fail(`${job.referencenumber} description must be HTML inside CDATA, not escaped text`);
    }

    let feedUrl: URL;
    try {
      feedUrl = new URL(row.url);
    } catch {
      fail(`${job.referencenumber} url is not absolute: ${row.url}`);
      continue;
    }
    if (feedUrl.origin !== new URL(base).origin) {
      fail(
        `${job.referencenumber} url origin ${feedUrl.origin} does not match ${base}. Unset SITE_URL when validating locally.`,
      );
    }
    if (feedUrl.searchParams.get("source") !== "Indeed") {
      fail(`${job.referencenumber} url is missing source=Indeed`);
    }

    const page = await fetch(feedUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    const html = await page.text();
    if (page.status !== 200) {
      fail(`${feedUrl} returned ${page.status}, expected 200`);
      continue;
    }

    const title = h1Text(html);
    if (title !== job.title) {
      fail(
        `${job.referencenumber} page h1 is ${JSON.stringify(title)}, expected ${JSON.stringify(job.title)}`,
      );
    } else {
      ok(`${job.referencenumber} page returned 200 with a matching title`);
    }

    for (const snippet of [job.city, job.state, job.postalcode, job.pay, job.description_html]) {
      if (!html.includes(snippet)) {
        fail(`${job.referencenumber} page is missing ${JSON.stringify(snippet.slice(0, 120))}`);
      }
    }
    if (!html.includes(`"postalCode":"${job.postalcode}"`)) {
      fail(`${job.referencenumber} JobPosting JSON-LD is missing postalCode ${job.postalcode}`);
    } else {
      ok(`${job.referencenumber} JSON-LD keeps ZIP ${job.postalcode}`);
    }

    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => decodeHtml(match[1]));
    const applyHref = hrefs.find((href) => {
      try {
        return new URL(href).searchParams.get("af_sub2") === job.referencenumber;
      } catch {
        return false;
      }
    });

    if (!applyHref) {
      fail(`${job.referencenumber} page is missing the Download button link`);
      continue;
    }
    const apply = new URL(applyHref);
    const pidCount = [...apply.searchParams.keys()].filter((key) => key === "pid").length;
    const expectedParams: Array<[string, string]> = [
      ["af_xp", "custom"],
      ["c", job.title_id],
      ["af_sub1", job.postalcode],
      ["af_sub2", job.referencenumber],
    ];
    const mismatched = expectedParams.filter(
      ([key, value]) => apply.searchParams.get(key) !== value,
    );
    const appendedWithAmpersand =
      applyHref.includes("&c=") &&
      applyHref.includes("&af_sub1=") &&
      applyHref.includes("&af_sub2=");
    if (pidCount !== 1 || apply.searchParams.get("pid") !== "job-board-xml") {
      fail(
        `${job.referencenumber} link must keep a single pid=job-board-xml from the base URL (${applyHref})`,
      );
    } else if (!appendedWithAmpersand) {
      fail(`${job.referencenumber} link must append c, af_sub1, and af_sub2 with & (${applyHref})`);
    } else if (mismatched.length > 0) {
      fail(
        `${job.referencenumber} link is missing ${mismatched
          .map(([key]) => key)
          .join(", ")} (${applyHref})`,
      );
    } else {
      ok(`${job.referencenumber} link keeps pid and appends c, af_sub1, and af_sub2`);
    }
  }

  for (const job of closed) {
    const page = await fetch(`${base}/jobs/${encodeURIComponent(job.referencenumber)}`, {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    const html = await page.text();
    if (page.status !== 410) {
      fail(`${job.referencenumber} returned ${page.status}, expected 410`);
      continue;
    }
    if (!/no longer available/i.test(html)) {
      fail(`${job.referencenumber} 410 page is missing the no longer available message`);
      continue;
    }
    if (/app\.hetalretail\.com|[?&]af_sub2=/i.test(html)) {
      fail(`${job.referencenumber} closed page still includes the apply link`);
      continue;
    }
    if (!html.includes(job.postalcode)) {
      fail(`${job.referencenumber} closed page dropped ZIP ${job.postalcode}`);
      continue;
    }
    ok(`${job.referencenumber} returns 410 and says the job is no longer available`);
  }

  const missing = await fetch(`${base}/jobs/HTL-DOES-NOT-EXIST`, {
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  if (missing.status !== 404) {
    fail(`unknown job returned ${missing.status}, expected 404`);
  } else {
    ok("unknown job returns 404");
  }

  report();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
