import assert from "node:assert/strict";
import { describe, it } from "node:test";

import sitemap from "../app/sitemap";
import titlesFile from "../config/titles.json";
import { buildAdzunaFeedXml, buildFeedXml, buildZipRecruiterFeedXml } from "../lib/feed";
import { compareJobs, loadJobs, openJobs } from "../lib/jobs";
import { parseTitlePool } from "../lib/schedule";
import { parseSheet } from "../lib/sheet";
import { syncSheetJobs } from "../lib/sync";
import type { Job } from "../lib/types";
import { jobCanonicalUrl, jobsHomeUrl } from "../lib/urls";

const titles = parseTitlePool(titlesFile);
const site = "https://www.hetalretail.com";

function visit(
  overrides: Partial<Job> & Pick<Job, "state" | "city" | "postalcode" | "priority">,
): Job {
  return {
    referencenumber:
      overrides.referencenumber ?? `HTL-${overrides.postalcode}-20261117-store-auditor-01`,
    requisitionid: "REQ-STORE-AUDITOR",
    title: "On-Demand Store Auditor",
    title_id: "store-auditor",
    country: "US",
    pay: "$6 - $17 per audit",
    jobtype: "contract",
    description_html: "<p>Audit</p>",
    status: "open",
    date_posted: "2026-11-17",
    ...overrides,
  };
}

function cdataValues(xml: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, "g");
  return [...xml.matchAll(pattern)].map((match) => match[1]);
}

describe("compareJobs", () => {
  const gilbert = visit({ state: "AZ", city: "Gilbert", postalcode: "85296", priority: 1 });
  const tucsonLow = visit({ state: "AZ", city: "Tucson", postalcode: "85710", priority: 1 });
  const tucsonHigh = visit({ state: "AZ", city: "Tucson", postalcode: "85737", priority: 1 });
  const nashua = visit({ state: "NH", city: "Nashua", postalcode: "03060", priority: 1 });
  const manchester = visit({ state: "NH", city: "Manchester", postalcode: "03101", priority: 1 });
  const anthem = visit({ state: "AZ", city: "Anthem", postalcode: "85086", priority: 2 });
  const boerne = visit({ state: "TX", city: "Boerne", postalcode: "78006", priority: 5 });
  const unranked = visit({
    state: "AZ",
    city: "Anthem",
    postalcode: "85086",
    priority: undefined,
    referencenumber: "HTL-85086-20261117-store-auditor-02",
  });
  const closedAnthem = visit({
    state: "AZ",
    city: "Anthem",
    postalcode: "85086",
    priority: 1,
    status: "closed",
    referencenumber: "HTL-85086-20261001-store-auditor-01",
  });

  it("sorts priority 1 through 5, then state, city, and ZIP", () => {
    const shuffled = [anthem, nashua, boerne, tucsonHigh, manchester, gilbert, tucsonLow];
    const ordered = [...shuffled].sort(compareJobs);
    assert.deepEqual(
      ordered.map((job) => `${job.priority} ${job.state} ${job.city} ${job.postalcode}`),
      [
        "1 AZ Gilbert 85296",
        "1 AZ Tucson 85710",
        "1 AZ Tucson 85737",
        "1 NH Manchester 03101",
        "1 NH Nashua 03060",
        "2 AZ Anthem 85086",
        "5 TX Boerne 78006",
      ],
    );
  });

  it("puts a missing priority after priority 5 and breaks ZIP ties by reference number", () => {
    const samePlace = visit({
      state: "TX",
      city: "Boerne",
      postalcode: "78006",
      priority: 5,
      referencenumber: "HTL-78006-20261117-mystery-shopper-01",
    });
    const byReference = [boerne, samePlace].sort((a, b) =>
      a.referencenumber.localeCompare(b.referencenumber, "en"),
    );
    const ordered = [unranked, samePlace, boerne].sort(compareJobs);
    assert.deepEqual(
      ordered.map((job) => job.referencenumber),
      [...byReference.map((job) => job.referencenumber), unranked.referencenumber],
    );
  });

  it("is the order openJobs, the feeds, and the sitemap share", () => {
    const jobs = [closedAnthem, anthem, nashua, tucsonHigh, gilbert, tucsonLow];
    const expected = [gilbert, tucsonLow, tucsonHigh, nashua, anthem].map(
      (job) => job.referencenumber,
    );
    assert.deepEqual(
      openJobs(jobs).map((job) => job.referencenumber),
      expected,
    );
    assert.deepEqual(cdataValues(buildFeedXml(jobs, site), "referencenumber"), expected);
    assert.deepEqual(cdataValues(buildAdzunaFeedXml(jobs, site), "id"), expected);
    assert.deepEqual(cdataValues(buildZipRecruiterFeedXml(jobs, site), "referencenumber"), expected);
    assert.deepEqual(
      jobs.map((job) => job.referencenumber),
      [
        closedAnthem.referencenumber,
        anthem.referencenumber,
        nashua.referencenumber,
        tucsonHigh.referencenumber,
        gilbert.referencenumber,
        tucsonLow.referencenumber,
      ],
    );
  });
});

describe("sheet sync order", () => {
  const csv = `City,Zip,Metro,Date Added
"Tucson, AZ",85737,"Tucson, AZ",11/2/26
"Anthem, AZ",85086,"Phoenix, AZ",10/26/26
"Tucson, AZ",85710,"Tucson, AZ",11/2/26
"Gilbert, AZ",85296,"Phoenix, AZ",11/2/26
"Nashua, NH",03060,"Boston, MA",11/2/26
`;

  it("writes open jobs priority first, then state, city, and ZIP, and keeps that on the next sync", () => {
    const rows = parseSheet(csv).rows;
    const first = syncSheetJobs(rows, [], "2026-11-05", titles);
    const open = first.filter((job) => job.status === "open");
    assert.deepEqual(
      open.map((job) => `${job.priority} ${job.postalcode}`),
      ["1 85296", "1 85710", "1 85737", "1 03060", "2 85086"],
    );
    assert.deepEqual(
      cdataValues(buildFeedXml(first, site), "referencenumber"),
      open.map((job) => job.referencenumber),
    );

    const again = syncSheetJobs(rows, first, "2026-11-05", titles);
    assert.deepEqual(
      again.filter((job) => job.status === "open").map((job) => job.referencenumber),
      open.map((job) => job.referencenumber),
    );
  });
});

describe("production order", () => {
  it("lists live open jobs in compareJobs order in the feeds and the sitemap", () => {
    const jobs = loadJobs();
    const open = openJobs(jobs);
    assert.ok(open.length >= 100);
    for (let index = 1; index < open.length; index += 1) {
      assert.ok(
        compareJobs(open[index - 1], open[index]) <= 0,
        `${open[index - 1].referencenumber} should sort before ${open[index].referencenumber}`,
      );
    }
    const refs = open.map((job) => job.referencenumber);
    assert.deepEqual(cdataValues(buildFeedXml(jobs, site), "referencenumber"), refs);
    assert.deepEqual(cdataValues(buildAdzunaFeedXml(jobs, site), "id"), refs);
    assert.deepEqual(cdataValues(buildZipRecruiterFeedXml(jobs, site), "referencenumber"), refs);
    assert.deepEqual(
      sitemap()
        .slice(1)
        .map((entry) => entry.url),
      open.map((job) => jobCanonicalUrl(jobsHomeUrl(), job.referencenumber)),
    );
  });
});
