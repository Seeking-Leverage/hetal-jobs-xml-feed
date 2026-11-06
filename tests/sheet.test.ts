import assert from "node:assert/strict";
import { describe, it } from "node:test";

import titlesFile from "../data/titles.json";
import sampleJobs from "../fixtures/sample-jobs.json";
import { openingLine } from "../lib/description";
import { parseJobs } from "../lib/jobs";
import { priorityByDateAdded } from "../lib/priority";
import { parseTitles } from "../lib/schedule";
import { buildFeedXml } from "../lib/feed";
import { buildOnelink } from "../lib/onelink";
import { parseSheet, rowsFromCsv } from "../lib/sheet";
import { syncSheetJobs } from "../lib/sync";
import { jobCanonicalUrl, publicSiteOrigin } from "../lib/urls";

const titles = parseTitles(titlesFile);
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
    const thursday = syncSheetJobs(parsed.rows, [], "2026-11-05", titles);
    const open = thursday.filter((job) => job.status === "open");
    assert.deepEqual(
      open.map((job) => job.postalcode).sort(),
      ["03060", "07094", "78006"],
    );
    assert.equal(open.every((job) => job.title === "Mystery Shopper" && job.title_id === "mystery-shopper"), true);
    assert.equal(open.every((job) => job.date_posted === "2026-11-05" && job.valid_through === "2026-11-05"), true);
    assert.equal(open.every((job) => job.pay === "$6 - $17 per audit"), true);
    const nashua = open.find((job) => job.postalcode === "03060");
    assert.equal(nashua?.city, "Nashua");
    assert.equal(nashua?.state, "NH");
    assert.equal(nashua?.metro, "Boston, MA");
    assert.equal(nashua?.referencenumber, "HTL-03060-20261105-mystery-shopper-01");
    assert.equal(nashua?.date_added, "2026-11-02");
    assert.equal(nashua?.priority, 1);
    const boerne = open.find((job) => job.postalcode === "78006");
    assert.equal(boerne?.date_added, "2026-10-12");
    assert.equal(boerne?.priority, 2);
    const xml = buildFeedXml(thursday, "https://www.hetalretail.com");
    assert.equal(xml.includes("channel="), false);
    assert.equal(xml.includes("source="), false);
    assert.match(
      xml,
      /<url><!\[CDATA\[https:\/\/www\.hetalretail\.com\/jobs\/HTL-03060-20261105-mystery-shopper-01\]\]><\/url>/,
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
    assert.equal(link.searchParams.get("af_adset"), "mystery-shopper");
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

  it("rotates titles by weekday and mixes all three across every ZIP on Friday through Monday", () => {
    const rows = parseSheet(csv).rows;
    const tuesday = syncSheetJobs(rows, [], "2026-11-03", titles);
    assert.equal(tuesday.filter((job) => job.status === "open").every((job) => job.title_id === "store-auditor"), true);
    const wednesday = syncSheetJobs(rows, tuesday, "2026-11-04", titles);
    const openWednesday = wednesday.filter((job) => job.status === "open");
    assert.equal(openWednesday.every((job) => job.title_id === "retail-merchandiser"), true);
    assert.equal(openWednesday.every((job) => job.referencenumber.includes("-20261104-retail-merchandiser-")), true);
    assert.equal(
      wednesday.some((job) => job.status === "closed" && job.title_id === "store-auditor" && job.date_posted === "2026-11-03"),
      true,
    );
    const friday = syncSheetJobs(rows, wednesday, "2026-11-06", titles);
    const openFriday = friday.filter((job) => job.status === "open");
    assert.deepEqual(openFriday.map((job) => job.postalcode).sort(), ["03060", "07094", "78006"]);
    assert.deepEqual(
      new Set(openFriday.map((job) => job.title_id)),
      new Set(["store-auditor", "retail-merchandiser", "mystery-shopper"]),
    );
    assert.equal(openFriday.every((job) => job.date_posted === "2026-11-06" && job.valid_through === "2026-11-09"), true);
    assert.equal(buildFeedXml(friday, "https://www.hetalretail.com").includes("<job>"), true);
    const fridayRefs = openFriday.map((job) => job.referencenumber).sort();
    for (const day of ["2026-11-07", "2026-11-08", "2026-11-09"]) {
      const later = syncSheetJobs(rows, friday, day, titles);
      const open = later.filter((job) => job.status === "open");
      assert.deepEqual(open.map((job) => job.referencenumber).sort(), fridayRefs);
      assert.equal(open.every((job) => job.valid_through === "2026-11-09"), true);
    }
  });

  it("reuses the same reference on a second sync and does not reuse it for a new title", () => {
    const rows = parseSheet(csv).rows;
    const first = syncSheetJobs(rows, [], "2026-11-05", titles);
    const again = syncSheetJobs(rows, first, "2026-11-05", titles);
    assert.deepEqual(
      again.filter((job) => job.status === "open").map((job) => job.referencenumber).sort(),
      first.filter((job) => job.status === "open").map((job) => job.referencenumber).sort(),
    );
    const nextTitle = syncSheetJobs(rows, again, "2026-11-10", titles);
    const nashua = nextTitle.filter((job) => job.postalcode === "03060");
    assert.equal(nashua.filter((job) => job.status === "open").length, 1);
    assert.equal(nashua.find((job) => job.status === "open")?.title_id, "store-auditor");
    assert.equal(nashua.some((job) => job.status === "closed" && job.title_id === "mystery-shopper"), true);
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
