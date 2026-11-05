import assert from "node:assert/strict";
import { describe, it } from "node:test";

import sampleJobs from "../fixtures/sample-jobs.json";
import { openingLine } from "../lib/description";
import { loadJobs, parseJobs } from "../lib/jobs";

describe("production jobs.json", () => {
  it("holds the 11/2/26 sheet week and not the sample fixtures", () => {
    const jobs = loadJobs();
    const open = jobs.filter((job) => job.status === "open");
    assert.equal(open.length, 60);
    assert.equal(open.every((job) => job.date_posted === "2026-11-02"), true);
    assert.equal(open.every((job) => job.valid_through === "2026-11-08"), true);
    assert.equal(new Set(open.map((job) => job.postalcode)).size, 60);
    assert.equal(open.every((job) => /^\d{5}$/.test(job.postalcode)), true);
    assert.equal(new Set(open.map((job) => job.referencenumber)).size, 60);
    assert.equal(
      open.every(
        (job) =>
          job.title === "On-Demand Store Auditor" &&
          job.title_id === "store-auditor" &&
          job.pay === "$6 - $17 per audit" &&
          job.jobtype === "contract" &&
          job.metro &&
          job.description_html.startsWith(`<p>${openingLine(job.city, job.state, job.postalcode)}</p>`),
      ),
      true,
    );
    const nashua = open.find((job) => job.city === "Nashua");
    assert.equal(nashua?.postalcode, "03060");
    assert.equal(nashua?.referencenumber, "HTL-03060-20261102-store-auditor-01");
    const fixtures = new Set(parseJobs(sampleJobs).map((job) => job.referencenumber));
    assert.equal(jobs.some((job) => fixtures.has(job.referencenumber)), false);
  });
});