import assert from "node:assert/strict";
import { describe, it } from "node:test";

import sampleJobs from "../fixtures/sample-jobs.json";
import { openingLine } from "../lib/description";
import { parseJobs } from "../lib/jobs";
import { jobsFromSheetRows, rowsFromCsv } from "../lib/sheet";

const csv = `City,Zip,Metro,Date Added
"Nashua, NH",3060,"Boston, MA",11/2/26
"Nashua, NH",3060,"Boston, MA",11/2/26
"Secaucus, NJ",07094,"New York, NY",11/2/26
"Boerne, TX",78006,"San Antonio, TX",10/12/26
`;

describe("sheet import", () => {
  it("pads ZIPs, splits city and state, and gives duplicates the next sequence", () => {
    const jobs = jobsFromSheetRows(rowsFromCsv(csv), {
      week: "2026-11-02",
      today: "2026-11-04",
    });
    assert.equal(jobs.length, 3);
    const nashua = jobs.filter((job) => job.postalcode === "03060");
    assert.deepEqual(
      nashua.map((job) => job.referencenumber),
      ["HTL-03060-20261102-store-auditor-01", "HTL-03060-20261102-store-auditor-02"],
    );
    assert.equal(nashua[0]?.city, "Nashua");
    assert.equal(nashua[0]?.state, "NH");
    assert.equal(nashua[0]?.metro, "Boston, MA");
    assert.equal(nashua[0]?.status, "open");
    assert.equal(nashua[0]?.valid_through, "2026-11-08");
    assert.equal(nashua[0]?.pay, "$6 - $17 per audit");
    assert.equal(nashua[0]?.description_html.startsWith(`<p>${openingLine("Nashua", "NH", "03060")}</p>`), true);
    assert.equal(jobs.some((job) => job.postalcode === "78006"), false);
  });

  it("stays open for seven days, then closes, and keeps a manual close", () => {
    const rows = rowsFromCsv(csv);
    const lastDay = jobsFromSheetRows(rows, { week: "2026-11-02", today: "2026-11-08" });
    assert.equal(lastDay.every((job) => job.status === "open"), true);
    const expired = jobsFromSheetRows(rows, { week: "2026-11-02", today: "2026-11-09" });
    assert.equal(expired.every((job) => job.status === "closed"), true);

    const open = jobsFromSheetRows(rows, { week: "2026-11-02", today: "2026-11-04" });
    const closedByHand = open.map((job) => ({ ...job, status: "closed" as const }));
    const again = jobsFromSheetRows(rows, {
      week: "2026-11-02",
      today: "2026-11-04",
      existing: closedByHand,
    });
    assert.equal(again.every((job) => job.status === "closed"), true);
    assert.deepEqual(
      again.map((job) => job.referencenumber).sort(),
      open.map((job) => job.referencenumber).sort(),
    );
  });

  it("keeps an older sheet visit closed instead of reusing its reference", () => {
    const older = jobsFromSheetRows(
      rowsFromCsv(`City,Zip,Metro,Date Added\n"Boerne, TX",78006,"San Antonio, TX",10/12/26\n`),
      { week: "2026-10-12", today: "2026-10-12" },
    );
    const next = jobsFromSheetRows(rowsFromCsv(csv), {
      week: "2026-11-02",
      today: "2026-11-04",
      existing: older,
    });
    const boerne = next.find((job) => job.postalcode === "78006");
    assert.equal(boerne?.status, "closed");
    assert.equal(boerne?.referencenumber, "HTL-78006-20261012-store-auditor-01");
  });

  it("does not mix the sample fixtures into a sheet import", () => {
    const jobs = jobsFromSheetRows(rowsFromCsv(csv), {
      week: "2026-11-02",
      today: "2026-11-04",
      existing: parseJobs(sampleJobs),
    });
    assert.equal(
      jobs.some((job) => job.referencenumber === "HTL-02139-20260915-store-auditor-01"),
      false,
    );
  });
});
