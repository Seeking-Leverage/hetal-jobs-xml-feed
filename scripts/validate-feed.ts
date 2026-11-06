import fs from "node:fs";
import path from "node:path";

import { XMLValidator } from "fast-xml-parser";

import { getCompanyName, getFeedEmail, getOnelinkBaseUrl } from "../lib/config";
import { loadJobs } from "../lib/jobs";
import { parseTitles, titleForDate } from "../lib/schedule";
import { todayInNewYork } from "../lib/sheet";
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

  const origin = (process.env.VALIDATE_BASE_URL ?? "http://127.0.0.1:43123")
    .replace(/\/$/, "")
    .replace(/\/jobs$/, "");
  const base = `${origin}/jobs`;

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

  const fixtureRefs = [
    "HTL-03060-20261101-store-auditor-01",
    "HTL-07094-20261102-store-auditor-01",
    "HTL-07601-20261103-store-auditor-01",
    "HTL-02139-20260915-store-auditor-01",
  ];
  const today = todayInNewYork();
  const title = titleForDate(
    today,
    parseTitles(JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "titles.json"), "utf8"))),
  );
  const mixed =
    new Set(open.map((job) => job.postalcode)).size !== open.length ||
    (title
      ? open.some(
          (job) => job.title_id !== title.title_id || job.title !== title.title || job.date_posted !== today,
        )
      : open.length !== 0);
  if (mixed) {
    fail(`open jobs do not match ${title?.title ?? "a closed day"} on ${today}`);
  } else if (title && open.length < 100) {
    fail(`expected every current sheet ZIP, found ${open.length} open jobs`);
  } else {
    ok(
      title
        ? `${open.length} open jobs use ${title.title} on ${today}`
        : `no open jobs on ${today}`,
    );
  }
  if (
    new Set(open.map((job) => job.postalcode)).size !== open.length ||
    open.some((job) => !/^\d{5}$/.test(job.postalcode))
  ) {
    fail("open jobs need a unique 5-digit ZIP");
  } else {
    ok("open ZIPs are unique 5-digit text");
  }
  const leaked = fixtureRefs.filter((ref) => jobs.some((job) => job.referencenumber === ref));
  if (leaked.length > 0) fail(`sample fixtures are in the production file: ${leaked.join(", ")}`);
  else ok("sample fixtures are not in the production file");

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

    const expectedPrefix = `HTL-${job.postalcode}-${job.date_posted.replaceAll("-", "")}-${job.title_id}-`;
    if (
      !/^HTL-\d{5}-\d{8}-[a-z0-9]+(?:-[a-z0-9]+)*-\d{2}$/.test(row.referencenumber) ||
      !row.referencenumber.startsWith(expectedPrefix)
    ) {
      fail(
        `${job.referencenumber} must be ${expectedPrefix}NN so the feed, page, and af_sub2 share one permanent id`,
      );
    }

    if (!/^\d{5}$/.test(row.postalcode)) {
      fail(`${job.referencenumber} postalcode must be 5 digits, received ${row.postalcode}`);
    } else if (row.postalcode !== job.postalcode) {
      fail(
        `${job.referencenumber} postalcode ${row.postalcode} does not match jobs.json ${job.postalcode}`,
      );
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
    if (feedUrl.origin !== origin) {
      fail(
        `${job.referencenumber} url origin ${feedUrl.origin} does not match ${origin}. Unset SITE_URL when validating locally.`,
      );
    }
    if (feedUrl.pathname !== `/jobs/${job.referencenumber}` || feedUrl.pathname.includes("/jobs/jobs/")) {
      fail(`${job.referencenumber} url path is ${feedUrl.pathname}, expected /jobs/${job.referencenumber}`);
    }
    if (feedUrl.searchParams.get("source") !== "Indeed") {
      fail(`${job.referencenumber} url is missing source=Indeed`);
    }
    if (feedUrl.searchParams.get("channel") !== "indeed") {
      fail(`${job.referencenumber} url is missing channel=indeed`);
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
    }

    for (const snippet of [job.city, job.state, job.postalcode, job.pay, job.description_html]) {
      if (!html.includes(snippet)) {
        fail(`${job.referencenumber} page is missing ${JSON.stringify(snippet.slice(0, 120))}`);
      }
    }
    if (!html.includes(`"postalCode":"${job.postalcode}"`)) {
      fail(`${job.referencenumber} JobPosting JSON-LD is missing postalCode ${job.postalcode}`);
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
    const keys = [...apply.searchParams.keys()];
    const pidCount = keys.filter((key) => key === "pid").length;
    const cCount = keys.filter((key) => key === "c").length;
    const expectedParams: Array<[string, string]> = [
      ["af_xp", "custom"],
      ["af_web_dp", "https://www.hetalretail.com/become-a-hetalite"],
      ["c", "xml-feed-hetal-website"],
      ["af_adset", job.title_id],
      ["af_sub1", job.postalcode],
      ["af_sub2", job.referencenumber],
    ];
    const mismatched = expectedParams.filter(
      ([key, value]) => apply.searchParams.get(key) !== value,
    );
    if (pidCount !== 1 || apply.searchParams.get("pid") !== "Indeed") {
      fail(
        `${job.referencenumber} link must use a single pid=Indeed from the feed (${applyHref})`,
      );
    } else if (cCount !== 1) {
      fail(`${job.referencenumber} link must contain c exactly once (${applyHref})`);
    } else if (apply.searchParams.get("c") === "indeed_launch" || applyHref.includes("indeed_launch")) {
      fail(`${job.referencenumber} link must not add c=indeed_launch (${applyHref})`);
    } else if (applyHref.includes(`c=${job.title_id}`)) {
      fail(`${job.referencenumber} link must not put the title in c (${applyHref})`);
    } else if (mismatched.length > 0) {
      fail(
        `${job.referencenumber} link is missing ${mismatched
          .map(([key]) => key)
          .join(", ")} (${applyHref})`,
      );
    }
  }
  ok("Indeed pages match title, pay, location, description, and pid=Indeed");

  if (open[0]) {
    const plain = await fetch(`${base}/${encodeURIComponent(open[0].referencenumber)}`, {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    const plainHtml = await plain.text();
    const plainHref = [...plainHtml.matchAll(/href="([^"]+)"/g)]
      .map((match) => decodeHtml(match[1]))
      .find((value) => value.includes("af_sub2="));
    const baseUrl = getOnelinkBaseUrl().replace(/[?&]$/, "");
    const plainLink = plainHref ? new URL(plainHref) : undefined;
    const plainKeys = plainLink ? [...plainLink.searchParams.keys()] : [];
    if (
      plain.status !== 200 ||
      !plainHref ||
      !plainLink ||
      !plainHref.startsWith(`${baseUrl}&`) ||
      plainLink.searchParams.get("pid") !== "xml-hetal" ||
      plainKeys.filter((key) => key === "pid").length !== 1 ||
      plainKeys.filter((key) => key === "c").length !== 1 ||
      plainLink.searchParams.get("c") !== "xml-feed-hetal-website" ||
      plainLink.searchParams.get("af_adset") !== open[0].title_id ||
      plainLink.searchParams.get("af_web_dp") !== "https://www.hetalretail.com/become-a-hetalite"
    ) {
      fail("a job page without channel must start from the base OneLink and keep pid=xml-hetal");
    } else {
      ok("job page without channel starts from the base OneLink and keeps pid=xml-hetal");
    }
  }

  for (const job of closed) {
    const page = await fetch(`${base}/${encodeURIComponent(job.referencenumber)}`, {
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
    if (/hetalretail\.onelink\.me|[?&]af_sub2=/i.test(html)) {
      fail(`${job.referencenumber} closed page still includes the apply link`);
      continue;
    }
    if (!html.includes(job.postalcode)) {
      fail(`${job.referencenumber} closed page dropped ZIP ${job.postalcode}`);
      continue;
    }
    ok(`${job.referencenumber} returns 410 and says the job is no longer available`);
  }

  async function checkChannelFeed(options: {
    path: string;
    idTag: string;
    pid: string;
    channel: string;
    tags: string[];
  }) {
    const response = await fetch(`${base}${options.path}`, {
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    });
    if (response.status !== 200) {
      fail(`${options.path} returned ${response.status}, expected 200`);
      return;
    }
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("application/xml")) {
      fail(`${options.path} Content-Type must include application/xml`);
    }
    const body = await response.text();
    const parsed = XMLValidator.validate(body);
    if (parsed !== true) {
      fail(`${options.path} XML is not well formed: ${parsed.err.msg}`);
      return;
    }
    if (ENTITY.test(body) || body.includes("<metro>")) {
      fail(`${options.path} must keep text in CDATA and leave metro out of the feed`);
    }
    const blocks = [...body.matchAll(/<job>([\s\S]*?)<\/job>/g)].map((match) => match[1]);
    if (blocks.length !== open.length) {
      fail(`${options.path} has ${blocks.length} jobs, expected ${open.length} open jobs`);
      return;
    }
    for (const job of closed) {
      if (body.includes(`<![CDATA[${job.referencenumber}]]>`)) {
        fail(`${options.path} includes closed job ${job.referencenumber}`);
      }
    }
    for (const job of open) {
      const block = blocks.find((entry) => cdataField(entry, options.idTag) === job.referencenumber);
      if (!block) {
        fail(`${options.path} is missing ${job.referencenumber}`);
        continue;
      }
      for (const tagName of options.tags) {
        const value = cdataField(block, tagName);
        if (!value?.trim()) {
          fail(`${options.path} ${job.referencenumber} is missing <${tagName}>`);
          continue;
        }
        if (tagName === "description" && value !== job.description_html) {
          fail(`${options.path} ${job.referencenumber} description does not match jobs.json`);
        }
        if (tagName === "title" && value !== job.title) {
          fail(`${options.path} ${job.referencenumber} title does not match`);
        }
        if (tagName === "salary" && value !== job.pay) {
          fail(`${options.path} ${job.referencenumber} pay does not match`);
        }
        if ((tagName === "postcode" || tagName === "postalcode") && value !== job.postalcode) {
          fail(`${options.path} ${job.referencenumber} ZIP does not match`);
        }
        if (tagName === "city" && value !== job.city) {
          fail(`${options.path} ${job.referencenumber} city does not match`);
        }
        if (tagName === "state" && value !== job.state) {
          fail(`${options.path} ${job.referencenumber} state does not match`);
        }
        if (tagName === "location" && value !== `${job.city}, ${job.state}`) {
          fail(`${options.path} ${job.referencenumber} location does not match`);
        }
      }
      const urlValue = cdataField(block, "url");
      if (!urlValue) continue;
      const feedUrl = new URL(urlValue);
      if (feedUrl.searchParams.get("channel") !== options.channel) {
        fail(`${options.path} ${job.referencenumber} url is missing channel=${options.channel}`);
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
      if (
        h1Text(html) !== job.title ||
        !html.includes(job.pay) ||
        !html.includes(job.postalcode) ||
        !html.includes(job.description_html)
      ) {
        fail(`${options.path} ${job.referencenumber} page does not match the job`);
      }
      const href = [...html.matchAll(/href="([^"]+)"/g)]
        .map((match) => decodeHtml(match[1]))
        .find((value) => {
          try {
            return new URL(value).searchParams.get("af_sub2") === job.referencenumber;
          } catch {
            return false;
          }
        });
      if (!href) {
        fail(`${options.path} ${job.referencenumber} page is missing the download link`);
        continue;
      }
      const apply = new URL(href);
      const keys = [...apply.searchParams.keys()];
      const pidCount = keys.filter((key) => key === "pid").length;
      const cCount = keys.filter((key) => key === "c").length;
      if (
        pidCount !== 1 ||
        cCount !== 1 ||
        apply.searchParams.get("pid") !== options.pid ||
        apply.searchParams.get("c") !== "xml-feed-hetal-website" ||
        apply.searchParams.get("af_adset") !== job.title_id ||
        apply.searchParams.get("af_sub1") !== job.postalcode ||
        apply.searchParams.get("af_sub2") !== job.referencenumber
      ) {
        fail(`${options.path} ${job.referencenumber} download link does not match ${options.pid}`);
      }
    }
    ok(`${options.path} lists every open job and uses pid=${options.pid}`);
  }

  await checkChannelFeed({
    path: "/adzuna.xml",
    idTag: "id",
    pid: "Adzuna",
    channel: "adzuna",
    tags: ["title", "description", "url", "location", "postcode", "country", "salary", "company"],
  });
  await checkChannelFeed({
    path: "/ziprecruiter.xml",
    idTag: "referencenumber",
    pid: "ZipRecruiter",
    channel: "ziprecruiter",
    tags: ["title", "description", "url", "city", "state", "country", "postalcode", "salary", "company"],
  });

  const missing = await fetch(`${base}/HTL-DOES-NOT-EXIST`, {
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
