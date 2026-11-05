import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getOnelinkBaseUrl } from "../lib/config";
import { buildJobPosting } from "../lib/jsonld";
import { findJob, loadJobs, openJobs } from "../lib/jobs";
import { buildOnelink } from "../lib/onelink";

const nashua = findJob("HTL-03060");
const secaucus = findJob("HTL-07094");
const hackensack = findJob("HTL-07601");
const cambridge = findJob("HTL-02139");

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
      open.some((job) => job.referencenumber === "HTL-02139"),
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

describe("OneLink", () => {
  it("keeps the Hetal pid and appends the campaign, ZIP, and reference", () => {
    assert.ok(nashua);
    const href = buildOnelink(nashua);
    assert.equal(
      href,
      "https://app.hetalretail.com/sfUI?af_xp=custom&pid=job-board-xml&c=store-auditor&af_sub1=03060&af_sub2=HTL-03060",
    );
    assert.equal(getOnelinkBaseUrl().includes("pid=indeed"), false);
    const url = new URL(href);
    assert.equal(url.searchParams.get("pid"), "job-board-xml");
    assert.equal([...url.searchParams.keys()].filter((key) => key === "pid").length, 1);
    assert.equal(url.searchParams.get("c"), "store-auditor");
    assert.equal(url.searchParams.get("af_sub1"), "03060");
    assert.equal(url.searchParams.get("af_sub2"), "HTL-03060");
    assert.equal(href.includes("&c="), true);
  });

  it("keeps the ZIP leading zero for Secaucus", () => {
    assert.ok(secaucus);
    const url = new URL(buildOnelink(secaucus));
    assert.equal(url.searchParams.get("af_sub1"), "07094");
    assert.equal(url.searchParams.get("af_sub2"), "HTL-07094");
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
    assert.equal(loadJobs().length, 4);
  });
});
