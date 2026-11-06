import assert from "node:assert/strict";
import { describe, it } from "node:test";

import sampleJobs from "../fixtures/sample-jobs.json";
import { getFeedEmail, getOnelinkBaseUrl } from "../lib/config";
import { buildJobPosting } from "../lib/jsonld";
import { parseJobs } from "../lib/jobs";
import { buildOnelink } from "../lib/onelink";

const sample = parseJobs(sampleJobs);
const nashua = sample.find((job) => job.referencenumber === "HTL-03060-20261101-store-auditor-01");
const secaucus = sample.find((job) => job.referencenumber === "HTL-07094-20261102-store-auditor-01");
const hackensack = sample.find((job) => job.referencenumber === "HTL-07601-20261103-store-auditor-01");
const cambridge = sample.find((job) => job.referencenumber === "HTL-02139-20260915-store-auditor-01");

describe("jobs.json", () => {
  it("keeps leading zeros on postal codes", () => {
    assert.ok(nashua);
    assert.equal(typeof nashua.postalcode, "string");
    assert.equal(nashua.postalcode, "03060");
    assert.ok(secaucus);
    assert.equal(secaucus.postalcode, "07094");
    assert.ok(hackensack);
    assert.equal(hackensack.postalcode, "07601");
  });

  it("lists only open jobs for the feed and the index", () => {
    const open = sample.filter((job) => job.status === "open");
    assert.equal(open.length, 3);
    assert.equal(
      open.some((job) => job.referencenumber === "HTL-02139-20260915-store-auditor-01"),
      false,
    );
    assert.equal(
      open.some((job) => job.status !== "open"),
      false,
    );
    assert.ok(cambridge);
    assert.equal(cambridge.status, "closed");
  });

  it("uses the same per-audit description on every visit, plus one local line", () => {
    const jobs = [nashua, secaucus, hackensack, cambridge];
    const localLines = jobs.map((job) => {
      assert.ok(job);
      assert.equal(job.pay, "$6 - $17 per audit");
      assert.equal(job.jobtype, "contract");
      assert.equal(job.title, "On-Demand Store Auditor");
      assert.equal(
        job.description_html.includes(
          `Flexible in-store audit work near ${job.city}, ${job.state} ${job.postalcode}.`,
        ),
        true,
      );
      assert.equal(
        job.description_html.includes("$6 to $17 per audit, depending on size"),
        true,
      );
      assert.equal(job.description_html.includes("per hour"), false);
      assert.equal(/contractor/i.test(job.description_html), false);
      assert.equal(job.description_html.includes("part-time"), false);
      return job.description_html;
    });
    assert.equal(new Set(localLines).size, localLines.length);
  });
});

const ONELINK_BASE =
  "https://hetalretail.onelink.me/sfUI?af_xp=custom&pid=xml-hetal&c=xml-feed-hetal-website&af_web_dp=https%3A%2F%2Fwww.hetalretail.com%2Fbecome-a-hetalite";

function paramCount(url: URL, key: string): number {
  return [...url.searchParams.keys()].filter((name) => name === key).length;
}

describe("OneLink", () => {
  it("starts from the base URL and keeps the website campaign", () => {
    assert.ok(nashua);
    const previous = process.env.ONELINK_BASE_URL;
    delete process.env.ONELINK_BASE_URL;
    try {
      const href = buildOnelink(nashua);
      assert.equal(
        href,
        `${ONELINK_BASE}&af_adset=store-auditor&af_sub1=03060&af_sub2=HTL-03060-20261101-store-auditor-01`,
      );
      assert.equal(getOnelinkBaseUrl(), ONELINK_BASE);
      assert.equal(href.includes("indeed.hetalretail.com"), false);
      assert.equal(href.includes("indeed_launch"), false);
      const url = new URL(href);
      assert.equal(url.searchParams.get("pid"), "xml-hetal");
      assert.equal(paramCount(url, "pid"), 1);
      assert.equal(paramCount(url, "c"), 1);
      assert.equal(url.searchParams.get("c"), "xml-feed-hetal-website");
      assert.equal(url.searchParams.get("af_xp"), "custom");
      assert.equal(url.searchParams.get("af_web_dp"), "https://www.hetalretail.com/become-a-hetalite");
      assert.equal(url.searchParams.get("af_adset"), "store-auditor");
      assert.equal(url.searchParams.get("af_sub1"), "03060");
      assert.equal(url.searchParams.get("af_sub2"), "HTL-03060-20261101-store-auditor-01");
    } finally {
      if (previous === undefined) delete process.env.ONELINK_BASE_URL;
      else process.env.ONELINK_BASE_URL = previous;
    }
  });

  it("keeps the ZIP leading zero for Secaucus", () => {
    assert.ok(secaucus);
    const url = new URL(buildOnelink(secaucus));
    assert.equal(url.searchParams.get("af_sub1"), "07094");
    assert.equal(url.searchParams.get("af_sub2"), "HTL-07094-20261102-store-auditor-01");
  });

  it("replaces pid for a board and never adds a second c or pid", () => {
    assert.ok(nashua);
    for (const [channel, source, pid] of [
      ["adzuna", "Adzuna", "Adzuna"],
      ["ziprecruiter", "ZipRecruiter", "ZipRecruiter"],
      ["indeed", "Indeed", "Indeed"],
    ] as const) {
      const href = buildOnelink(nashua, { channel, source });
      const url = new URL(href);
      assert.equal(url.searchParams.get("pid"), pid);
      assert.equal(paramCount(url, "pid"), 1);
      assert.equal(paramCount(url, "c"), 1);
      assert.equal(url.searchParams.get("c"), "xml-feed-hetal-website");
      assert.equal(url.searchParams.get("af_adset"), "store-auditor");
      assert.equal(url.searchParams.get("af_sub1"), "03060");
      assert.equal(url.searchParams.get("af_sub2"), nashua.referencenumber);
      assert.equal(href.includes("indeed_launch"), false);
    }

    const fromChannel = new URL(buildOnelink(nashua, { channel: "adzuna" }));
    assert.equal(fromChannel.searchParams.get("pid"), "Adzuna");
    assert.equal(paramCount(fromChannel, "c"), 1);

    const otherBoard = new URL(buildOnelink(nashua, { channel: "talent", source: "Talent" }));
    assert.equal(otherBoard.searchParams.get("pid"), "Talent");
    assert.equal(otherBoard.searchParams.get("c"), "xml-feed-hetal-website");
    assert.equal(paramCount(otherBoard, "pid"), 1);

    const unsafe = new URL(buildOnelink(nashua, { channel: "bad pid", source: "a&b=c" }));
    assert.equal(unsafe.searchParams.get("pid"), "xml-hetal");
    assert.equal(paramCount(unsafe, "pid"), 1);
    assert.equal(paramCount(unsafe, "c"), 1);

    const slugOnly = new URL(buildOnelink(nashua, { channel: "monster" }));
    assert.equal(slugOnly.searchParams.get("pid"), "monster");
    assert.equal(slugOnly.searchParams.get("c"), "xml-feed-hetal-website");
    assert.equal(paramCount(slugOnly, "pid"), 1);
    assert.equal(paramCount(slugOnly, "c"), 1);
  });

  it("drops a second c or pid and keeps the encoded web destination", () => {
    assert.ok(nashua);
    const previous = process.env.ONELINK_BASE_URL;
    process.env.ONELINK_BASE_URL =
      "https://hetalretail.onelink.me/sfUI?af_xp=custom&pid=xml-hetal&c=xml-feed-hetal-website&pid=Indeed&c=store-auditor&af_web_dp=https%3A%2F%2Fwww.hetalretail.com%2Fbecome-a-hetalite&af_adset=old&af_sub1=00000&af_sub2=OLD";
    try {
      const href = buildOnelink(nashua, { channel: "monster" });
      const url = new URL(href);
      assert.equal(paramCount(url, "c"), 1);
      assert.equal(paramCount(url, "pid"), 1);
      assert.equal(url.searchParams.get("c"), "xml-feed-hetal-website");
      assert.equal(url.searchParams.get("pid"), "monster");
      assert.equal(url.searchParams.get("af_xp"), "custom");
      assert.equal(url.searchParams.get("af_web_dp"), "https://www.hetalretail.com/become-a-hetalite");
      assert.equal(url.searchParams.get("af_adset"), "store-auditor");
      assert.equal(url.searchParams.get("af_sub1"), "03060");
      assert.equal(url.searchParams.get("af_sub2"), nashua.referencenumber);
      assert.equal(
        href.includes("af_web_dp=https%3A%2F%2Fwww.hetalretail.com%2Fbecome-a-hetalite"),
        true,
      );
      assert.equal(href.includes("c=store-auditor"), false);
      assert.equal(href.includes("pid=Indeed"), false);
    } finally {
      if (previous === undefined) delete process.env.ONELINK_BASE_URL;
      else process.env.ONELINK_BASE_URL = previous;
    }
  });
});

describe("feed contact", () => {
  it("defaults the feed email to marketing@hetalretail.com", () => {
    const previous = process.env.FEED_CONTACT_EMAIL;
    delete process.env.FEED_CONTACT_EMAIL;
    try {
      assert.equal(getFeedEmail(), "marketing@hetalretail.com");
    } finally {
      if (previous === undefined) delete process.env.FEED_CONTACT_EMAIL;
      else process.env.FEED_CONTACT_EMAIL = previous;
    }
  });
});

describe("JobPosting", () => {
  it("matches the visible job and records per-audit contractor pay", () => {
    assert.ok(nashua);
    const schema = buildJobPosting(nashua, "http://127.0.0.1:43123");
    assert.equal(schema.title, nashua.title);
    assert.equal(schema.datePosted, nashua.date_posted);
    assert.equal(schema.employmentType, "CONTRACTOR");
    assert.equal(schema.description, nashua.description_html);
    const location = schema.jobLocation as {
      address: { postalCode: string; addressRegion: string };
    };
    assert.equal(typeof location.address.postalCode, "string");
    assert.equal(location.address.postalCode, "03060");
    assert.equal(location.address.addressRegion, "NH");
    assert.equal("baseSalary" in schema, false);
    assert.equal(nashua.pay, "$6 - $17 per audit");
    assert.equal(schema.description.includes("$6 to $17 per audit, depending on size"), true);
    assert.equal(schema.url, "http://127.0.0.1:43123/jobs/HTL-03060-20261101-store-auditor-01");
  });

  it("reads the four sample fixtures", () => {
    const jobs = sample;
    assert.equal(jobs.length, 4);
    const refs = jobs.map((job) => job.referencenumber);
    assert.equal(new Set(refs).size, refs.length);
    for (const job of jobs) {
      const expected = `HTL-${job.postalcode}-${job.date_posted.replaceAll("-", "")}-${job.title_id}-01`;
      assert.equal(job.referencenumber, expected);
      assert.match(job.referencenumber, /^HTL-\d{5}-\d{8}-[a-z0-9]+(?:-[a-z0-9]+)*-\d{2}$/);
    }
  });
});
