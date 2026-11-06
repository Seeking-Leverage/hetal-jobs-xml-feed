import assert from "node:assert/strict";
import { describe, it } from "node:test";

import titlesFile from "../data/titles.json";
import sampleJobs from "../fixtures/sample-jobs.json";
import { openingLine } from "../lib/description";
import { loadJobs, parseJobs } from "../lib/jobs";
import { parseTitles, planForDate } from "../lib/schedule";
import { todayInNewYork } from "../lib/sheet";

describe("production jobs.json", () => {
  it("matches today's weekday and leaves the sample fixtures out", () => {
    const jobs = loadJobs();
    const open = jobs.filter((job) => job.status === "open");
    const today = todayInNewYork();
    const plan = planForDate(today, parseTitles(titlesFile));
    assert.ok(open.length >= 100, `expected the sheet ZIPs to be open, found ${open.length}`);
    assert.equal(new Set(open.map((job) => job.postalcode)).size, open.length);
    assert.equal(
      open.every(
        (job) =>
          job.date_posted === plan.date &&
          job.valid_through === plan.validThrough &&
          (plan.title === null || job.title_id === plan.title.title_id) &&
          job.referencenumber.startsWith(
            `HTL-${job.postalcode}-${plan.date.replaceAll("-", "")}-${job.title_id}-`,
          ),
      ),
      true,
    );
    if (plan.title === null) {
      assert.equal(new Set(open.map((job) => job.title_id)).size, 3);
    }
    assert.equal(open.every((job) => /^\d{5}$/.test(job.postalcode)), true);
    assert.equal(new Set(jobs.map((job) => job.referencenumber)).size, jobs.length);
    assert.equal(
      jobs.every(
        (job) =>
          job.pay === "$6 - $17 per audit" &&
          job.jobtype === "contract" &&
          !/contractor/i.test(job.description_html) &&
          job.description_html.startsWith(`<p>${openingLine(job.city, job.state, job.postalcode)}</p>`),
      ),
      true,
    );
    const fixtures = new Set(parseJobs(sampleJobs).map((job) => job.referencenumber));
    assert.equal(jobs.some((job) => fixtures.has(job.referencenumber)), false);
  });
});
