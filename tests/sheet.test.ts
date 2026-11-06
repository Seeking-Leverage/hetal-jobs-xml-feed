import assert from "node:assert/strict";
import { describe, it } from "node:test";

import titlesFile from "../data/titles.json";
import sampleJobs from "../fixtures/sample-jobs.json";
import { openingLine } from "../lib/description";
import { parseJobs } from "../lib/jobs";
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

  it("rotates titles by weekday and closes Friday through Monday", () => {
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
    assert.equal(friday.filter((job) => job.status === "open").length, 0);
    assert.equal(buildFeedXml(friday, "https://www.hetalretail.com").includes("<job>"), false);
    const monday = syncSheetJobs(rows, friday, "2026-11-09", titles);
    assert.equal(monday.filter((job) => job.status === "open").length, 0);
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
