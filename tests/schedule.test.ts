import assert from "node:assert/strict";
import { describe, it } from "node:test";

import titlesFile from "../config/titles.json";
import { buildFeedXml } from "../lib/feed";
import { buildJobPosting } from "../lib/jsonld";
import { buildOnelink } from "../lib/onelink";
import {
  parseTitlePool,
  recordTitleDay,
  titleForDate,
  type TitlePool,
} from "../lib/schedule";
import { parseSheet } from "../lib/sheet";
import { syncSheetJobs } from "../lib/sync";

const pool = parseTitlePool(titlesFile);
const names = [
  "In-Store Auditor",
  "Flexible Gig | Shelf Auditor | Available Now",
  "In-Store Shelf Auditor - Flexible Gig, Fast Cash",
  "In-Store Shelf Auditor - No Driving",
];

function dateOnDay(offset: number): string {
  const date = new Date(Date.UTC(2026, 10, 17 + offset));
  return date.toISOString().slice(0, 10);
}

describe("title pool", () => {
  it("rotates the four active titles in order and then loops", () => {
    assert.deepEqual(
      pool.titles.map((title) => title.title),
      names,
    );
    const sequence = Array.from({ length: 8 }, (_, offset) => titleForDate(dateOnDay(offset), pool).title);
    assert.deepEqual(sequence, [...names, ...names]);
    assert.equal(titleForDate("2026-11-17", pool).title_id, titleForDate("2026-11-17", pool).title_id);
  });

  it("keeps a heavier title for that many days and skips an inactive title", () => {
    const weighted: TitlePool = {
      start_date: "2026-11-17",
      titles: pool.titles.map((title, index) =>
        index === 2 ? { ...title, weight: 2 } : { ...title, weight: 1 },
      ),
    };
    assert.deepEqual(
      Array.from({ length: 10 }, (_, offset) => titleForDate(dateOnDay(offset), weighted).title),
      [
        names[0],
        names[1],
        names[2],
        names[2],
        names[3],
        names[0],
        names[1],
        names[2],
        names[2],
        names[3],
      ],
    );

    const paused: TitlePool = {
      start_date: "2026-11-17",
      titles: pool.titles.map((title, index) => ({ ...title, active: index !== 1 })),
    };
    assert.deepEqual(
      Array.from({ length: 6 }, (_, offset) => titleForDate(dateOnDay(offset), paused).title),
      [names[0], names[2], names[3], names[0], names[2], names[3]],
    );
  });

  it("records one history row per day", () => {
    const first = titleForDate("2026-11-17", pool);
    const second = titleForDate("2026-11-18", pool);
    const once = recordTitleDay([], "2026-11-17", first);
    const twice = recordTitleDay(once, "2026-11-17", first);
    const next = recordTitleDay(twice, "2026-11-18", second);
    assert.equal(twice.length, 1);
    assert.deepEqual(
      next.map((entry) => entry.date),
      ["2026-11-17", "2026-11-18"],
    );
    assert.equal(next[0]?.title_id, first.title_id);
    assert.equal(next[1]?.title, second.title);
  });

  it("puts the day's exact title in the feed, the page data, and af_adset", () => {
    const rows = parseSheet(`City,Zip,Metro,Date Added
"Nashua, NH",03060,"Boston, MA",11/16/26
`).rows;
    const day = "2026-11-18";
    const title = titleForDate(day, pool);
    const jobs = syncSheetJobs(rows, [], day, pool);
    const open = jobs.filter((job) => job.status === "open");
    assert.equal(open.length, 1);
    const job = open[0];
    assert.ok(job);
    assert.equal(job.title, "Flexible Gig | Shelf Auditor | Available Now");
    assert.equal(job.referencenumber, "HTL-03060-20261118-flexible-gig-shelf-auditor-01");
    const xml = buildFeedXml(jobs, "https://www.hetalretail.com");
    assert.equal(
      xml.includes("<title><![CDATA[Flexible Gig | Shelf Auditor | Available Now]]></title>"),
      true,
    );
    assert.equal(xml.includes("Mystery Shopper"), false);
    assert.equal(xml.includes("Retail Merchandiser"), false);
    assert.equal(xml.includes("On-Demand Store Auditor"), false);
    assert.equal(buildJobPosting(job, "https://www.hetalretail.com").title, job.title);
    const link = new URL(buildOnelink(job));
    assert.equal(link.searchParams.get("af_adset"), title.title_id);
    assert.equal(link.searchParams.get("af_sub1"), "03060");
    assert.equal(link.searchParams.get("af_sub2"), job.referencenumber);
    assert.equal(link.searchParams.get("pid"), "xml-hetal");
    assert.equal(link.searchParams.get("c"), "xml-feed-hetal-website");
  });
});
