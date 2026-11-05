import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getFeedEmail, getOnelinkBaseUrl } from "../lib/config";
import { buildJobPosting } from "../lib/jsonld";
import { findJob, loadJobs, openJobs } from "../lib/jobs";
import { buildOnelink } from "../lib/onelink";

const nashua = findJob("HTL-03060-20261101-store-auditor");
const secaucus = findJob("HTL-07094-20261102-store-auditor");
const hackensack = findJob("HTL-07601-20261103-store-auditor");
const cambridge = findJob("HTL-02139-20260915-store-auditor");

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
    const open = openJobs();
    assert.equal(open.length, 3);
    assert.equal(
      open.some((job) => job.referencenumber === "HTL-02139-20260915-store-auditor"),
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
      assert.equal(job.description_html.includes("part-time"), false);
      return job.description_html;
    });
    assert.equal(new Set(localLines).size, localLines.length);
  });
});

const ONELINK_BASE =
  "https://hetalretail.onelink.me/sfUI?af_web_dp=http%3A%2F%2Findeed.hetalretail.com%2F&af_xp=custom&pid=Indeed";

describe("OneLink", () => {
  it("keeps pid=Indeed and appends only the campaign, ZIP, and reference", () => {
    assert.ok(nashua);
    const previous = process.env.ONELINK_BASE_URL;
    delete process.env.ONELINK_BASE_URL;
    try {
      const href = buildOnelink(nashua);
      assert.equal(
        href,
        `${ONELINK_BASE}&c=store-auditor&af_sub1=03060&af_sub2=HTL-03060-20261101-store-auditor`,
      );
      assert.equal(getOnelinkBaseUrl(), ONELINK_BASE);
      assert.equal(href.includes("app.hetalretail.com"), false);
      assert.equal(href.includes("indeed_launch"), false);
      const url = new URL(href);
      assert.equal(url.searchParams.get("pid"), "Indeed");
      assert.equal([...url.searchParams.keys()].filter((key) => key === "pid").length, 1);
      assert.equal([...url.searchParams.keys()].filter((key) => key === "c").length, 1);
      assert.equal(url.searchParams.get("c"), "store-auditor");
      assert.equal(url.searchParams.get("af_web_dp"), "http://indeed.hetalretail.com/");
      assert.equal(url.searchParams.get("af_sub1"), "03060");
      assert.equal(url.searchParams.get("af_sub2"), "HTL-03060-20261101-store-auditor");
      assert.equal(href.includes("&c="), true);
    } finally {
      if (previous === undefined) delete process.env.ONELINK_BASE_URL;
      else process.env.ONELINK_BASE_URL = previous;
    }
  });

  it("keeps the ZIP leading zero for Secaucus", () => {
    assert.ok(secaucus);
    const url = new URL(buildOnelink(secaucus));
    assert.equal(url.searchParams.get("af_sub1"), "07094");
    assert.equal(url.searchParams.get("af_sub2"), "HTL-07094-20261102-store-auditor");
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
    assert.deepEqual(schema.baseSalary, {
      "@type": "MonetaryAmount",
      currency: "USD",
      value: {
        "@type": "QuantitativeValue",
        unitText: "PIECE",
        minValue: 6,
        maxValue: 17,
      },
    });
  });

  it("reads four jobs from data/jobs.json", () => {
    const jobs = loadJobs();
    assert.equal(jobs.length, 4);
    const refs = jobs.map((job) => job.referencenumber);
    assert.equal(new Set(refs).size, refs.length);
    for (const job of jobs) {
      const expected = `HTL-${job.postalcode}-${job.date_posted.replaceAll("-", "")}-${job.title_id}`;
      assert.equal(job.referencenumber, expected);
      assert.match(job.referencenumber, /^HTL-\d{5}-\d{8}-[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });
});
