import assert from "node:assert/strict";
import { describe, it } from "node:test";

import titlesFile from "../config/titles.json";
import sampleJobs from "../fixtures/sample-jobs.json";
import { openingLine } from "../lib/description";
import { parseJobs } from "../lib/jobs";
import { priorityByDateAdded } from "../lib/priority";
import { parseTitlePool, titleForDate } from "../lib/schedule";
import { buildFeedXml } from "../lib/feed";
import { buildOnelink } from "../lib/onelink";
import { parseSheet, rowsFromCsv } from "../lib/sheet";
import { syncSheetJobs } from "../lib/sync";
import { jobCanonicalUrl, publicSiteOrigin } from "../lib/urls";

const titles = parseTitlePool(titlesFile);
const csv = `City,Zip,Metro,Date Added
"Nashua, NH",3060,"Boston, MA",11/2/26
"Nashua, NH",3060,"Boston, MA",11/2/26
"Secaucus, NJ",07094,"New York, NY",11/2/26
"Boerne, TX",78006,"San Antonio, TX",10/12/26
"Broken, ZZ",12ab,"Nowhere",11/2/26
`;

describe("sheet import", () => {
  it("keeps every unique valid ZIP, including older weeks", () => {
    const parsed = parseSheet(csv);
    assert.equal(parsed.skipped.length, 1);
    const dayTitle = titleForDate("2026-11-05", titles);
    const thursday = syncSheetJobs(parsed.rows, [], "2026-11-05", titles);
    const open = thursday.filter((job) => job.status === "open");
    assert.deepEqual(
      open.map((job) => job.postalcode).sort(),
      ["03060", "07094", "78006"],
    );
    assert.equal(open.every((job) => job.title === dayTitle.title && job.title_id === dayTitle.title_id), true);
    assert.equal(open.every((job) => job.date_posted === "2026-11-05" && job.valid_through === "2026-11-05"), true);
    assert.equal(open.every((job) => job.pay === "$6 - $17 per audit"), true);
    const nashua = open.find((job) => job.postalcode === "03060");
    assert.equal(nashua?.city, "Nashua");
    assert.equal(nashua?.state, "NH");
    assert.equal(nashua?.metro, "Boston, MA");
    assert.equal(nashua?.referencenumber, `HTL-03060-20261105-${dayTitle.title_id}-01`);
    assert.equal(nashua?.date_added, "2026-11-02");
    assert.equal(nashua?.priority, 1);
    const boerne = open.find((job) => job.postalcode === "78006");
    assert.equal(boerne?.date_added, "2026-10-12");
    assert.equal(boerne?.priority, 2);
    const xml = buildFeedXml(thursday, "https://www.hetalretail.com");
    assert.equal(xml.includes("channel="), false);
    assert.equal(xml.includes("source="), false);
    assert.equal(
      xml.includes(
        `<url><![CDATA[https://www.hetalretail.com/jobs/HTL-03060-20261105-${dayTitle.title_id}-01]]></url>`,
      ),
      true,
    );
    assert.match(xml, /<priority>1<\/priority>/);
    assert.match(xml, /<priority>2<\/priority>/);
    assert.equal(
      nashua?.description_html.startsWith(`<p>${openingLine("Nashua", "NH", "03060")}</p>`),
      true,
    );
    assert.equal(rowsFromCsv(csv.replace("Broken, ZZ", "Austin, TX").replace("12ab", "78701")).length, 5);
    const href = buildOnelink(nashua!);
    const link = new URL(href);
    assert.equal(link.searchParams.get("c"), "xml-feed-hetal-website");
    assert.equal(link.searchParams.get("af_adset"), dayTitle.title_id);
    assert.equal([...link.searchParams.keys()].filter((key) => key === "c").length, 1);
  });

  it("ranks the newest Date Added week as 1 and keeps older weeks at 5", () => {
    assert.deepEqual(
      [...priorityByDateAdded(["2026-10-12", "2026-11-02", "2026-10-26", "2026-10-19", "2026-10-05", "2026-09-28"]).entries()],
      [
        ["2026-11-02", 1],
        ["2026-10-26", 2],
        ["2026-10-19", 3],
        ["2026-10-12", 4],
        ["2026-10-05", 5],
        ["2026-09-28", 5],
      ],
    );
    const older = `City,Zip,Metro,Date Added
"Nashua, NH",03060,"Boston, MA",10/26/26
"Secaucus, NJ",07094,"New York, NY",10/12/26
`;
    const withNewest = `${older}"Boerne, TX",78006,"San Antonio, TX",11/2/26
`;
    const before = syncSheetJobs(parseSheet(older).rows, [], "2026-11-05", titles);
    assert.equal(before.find((job) => job.status === "open" && job.postalcode === "03060")?.priority, 1);
    assert.equal(before.find((job) => job.status === "open" && job.postalcode === "07094")?.priority, 2);
    const after = syncSheetJobs(parseSheet(withNewest).rows, before, "2026-11-05", titles);
    assert.equal(after.filter((job) => job.status === "open").length, 3);
    assert.equal(after.find((job) => job.status === "open" && job.postalcode === "78006")?.priority, 1);
    assert.equal(after.find((job) => job.status === "open" && job.postalcode === "03060")?.priority, 2);
    assert.equal(after.find((job) => job.status === "open" && job.postalcode === "07094")?.priority, 3);
    assert.equal(after.find((job) => job.postalcode === "03060" && job.status === "open")?.referencenumber, before.find((job) => job.postalcode === "03060")?.referencenumber);
  });

  it("keeps the five newest Date Added weeks and closes older weeks", () => {
    const csvSixWeeks = `City,Zip,Metro,Date Added
"Nashua, NH",03060,"Boston, MA",11/16/26
"Secaucus, NJ",07094,"New York, NY",11/9/26
"Hackensack, NJ",07601,"New York, NY",11/2/26
"Cambridge, MA",02139,"Boston, MA",10/26/26
"Helotes, TX",78023,"San Antonio, TX",10/19/26
"Boerne, TX",78006,"San Antonio, TX",10/12/26
`;
    const rows = parseSheet(csvSixWeeks).rows;
    const first = syncSheetJobs(rows, [], "2026-11-23", titles);
    const open = first.filter((job) => job.status === "open");
    assert.deepEqual(
      open.map((job) => `${job.priority} ${job.postalcode} ${job.date_added}`).sort(),
      [
        "1 03060 2026-11-16",
        "2 07094 2026-11-09",
        "3 07601 2026-11-02",
        "4 02139 2026-10-26",
        "5 78023 2026-10-19",
      ],
    );
    assert.equal(first.some((job) => job.postalcode === "78006"), false);
    assert.equal(buildFeedXml(first, "https://www.hetalretail.com").includes("78006"), false);

    const withNewer = parseSheet(`${csvSixWeeks}"Gilbert, AZ",85296,"Phoenix, AZ",11/23/26
`).rows;
    const next = syncSheetJobs(withNewer, first, "2026-11-23", titles);
    const openNext = next.filter((job) => job.status === "open");
    assert.equal(openNext.find((job) => job.postalcode === "85296")?.priority, 1);
    assert.equal(openNext.find((job) => job.postalcode === "03060")?.priority, 2);
    assert.equal(openNext.some((job) => job.postalcode === "78023"), false);
    assert.equal(next.find((job) => job.postalcode === "78023")?.status, "closed");
  });

  it("gives every ZIP the day's title and a new reference on the next day", () => {
    const rows = parseSheet(csv).rows;
    let jobs = syncSheetJobs(rows, [], "2026-11-17", titles);
    let previousRefs: string[] = [];
    for (let offset = 0; offset < 8; offset += 1) {
      const day = `2026-11-${String(17 + offset).padStart(2, "0")}`;
      jobs = syncSheetJobs(rows, offset === 0 ? [] : jobs, day, titles);
      const open = jobs.filter((job) => job.status === "open");
      const title = titleForDate(day, titles);
      assert.equal(open.length, 3);
      assert.equal(open.every((job) => job.title === title.title && job.title_id === title.title_id), true);
      assert.equal(open.every((job) => job.date_posted === day && job.valid_through === day), true);
      assert.equal(buildFeedXml(jobs, "https://www.hetalretail.com").includes("<job>"), true);
      const refs = open.map((job) => job.referencenumber).sort();
      if (offset > 0) {
        assert.equal(refs.some((ref) => previousRefs.includes(ref)), false);
        assert.equal(
          jobs.some((job) => job.status === "closed" && job.date_posted === `2026-11-${String(16 + offset).padStart(2, "0")}`),
          true,
        );
      }
      const again = syncSheetJobs(rows, jobs, day, titles);
      assert.deepEqual(
        again.filter((job) => job.status === "open").map((job) => job.referencenumber).sort(),
        refs,
      );
      previousRefs = refs;
      jobs = again;
    }
  });

  it("reuses the same reference on a second sync and does not reuse it for a new title", () => {
    const rows = parseSheet(csv).rows;
    const firstTitle = titleForDate("2026-11-05", titles);
    const nextTitle = titleForDate("2026-11-10", titles);
    const first = syncSheetJobs(rows, [], "2026-11-05", titles);
    const again = syncSheetJobs(rows, first, "2026-11-05", titles);
    assert.deepEqual(
      again.filter((job) => job.status === "open").map((job) => job.referencenumber).sort(),
      first.filter((job) => job.status === "open").map((job) => job.referencenumber).sort(),
    );
    const next = syncSheetJobs(rows, again, "2026-11-10", titles);
    const nashua = next.filter((job) => job.postalcode === "03060");
    assert.notEqual(firstTitle.title_id, nextTitle.title_id);
    assert.equal(nashua.filter((job) => job.status === "open").length, 1);
    assert.equal(nashua.find((job) => job.status === "open")?.title_id, nextTitle.title_id);
    assert.equal(nashua.some((job) => job.status === "closed" && job.title_id === firstTitle.title_id), true);
  });

  it("closes a ZIP that leaves the sheet", () => {
    const rows = parseSheet(csv).rows;
    const thursday = syncSheetJobs(rows, [], "2026-11-05", titles);
    const withoutNashua = rows.filter((row) => row.postalcode !== "03060");
    const next = syncSheetJobs(withoutNashua, thursday, "2026-11-05", titles);
    assert.equal(next.find((job) => job.postalcode === "03060")?.status, "closed");
    assert.equal(next.filter((job) => job.status === "open" && job.postalcode === "03060").length, 0);
    assert.equal(next.filter((job) => job.status === "open").length, 2);
  });

  it("does not open the sample fixtures", () => {
    const jobs = syncSheetJobs(parseSheet(csv).rows, parseJobs(sampleJobs), "2026-11-05", titles);
    const fixture = jobs.find((job) => job.referencenumber === "HTL-02139-20260915-store-auditor-01");
    assert.equal(fixture?.status, "closed");
    assert.equal(
      jobCanonicalUrl("https://www.hetalretail.com", "HTL-03060-20261105-mystery-shopper-01"),
      "https://www.hetalretail.com/jobs/HTL-03060-20261105-mystery-shopper-01",
    );
  });

  it("publishes https://www.hetalretail.com in production", () => {
    assert.equal(publicSiteOrigin("http://127.0.0.1:43123", true), "https://www.hetalretail.com");
    assert.equal(publicSiteOrigin("https://hetal-jobs.vercel.app", true), "https://www.hetalretail.com");
    assert.equal(
      jobCanonicalUrl("http://127.0.0.1:43123", "HTL-03060-20261105-mystery-shopper-01", true),
      "https://www.hetalretail.com/jobs/HTL-03060-20261105-mystery-shopper-01",
    );
    assert.equal(
      jobCanonicalUrl("https://www.hetalretail.com", "HTL-03060-20261105-mystery-shopper-01").includes("/jobs/jobs/"),
      false,
    );
  });
});
