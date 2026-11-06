import assert from "node:assert/strict";
import { describe, it } from "node:test";

import titlesFile from "../data/titles.json";
import sampleJobs from "../fixtures/sample-jobs.json";
import { openingLine } from "../lib/description";
import { loadJobs, parseJobs } from "../lib/jobs";
import { parseTitles, titleForDate } from "../lib/schedule";
import { todayInNewYork } from "../lib/sheet";

describe("production jobs.json", () => {
  it("matches today's weekday and leaves the sample fixtures out", () => {
    const jobs = loadJobs();
    const open = jobs.filter((job) => job.status === "open");
    const today = todayInNewYork();
    const title = titleForDate(today, parseTitles(titlesFile));
    if (!title) {
      assert.equal(open.length, 0);
    } else {
      assert.ok(open.length >= 100, `expected the sheet ZIPs to be open, found ${open.length}`);
      assert.equal(new Set(open.map((job) => job.postalcode)).size, open.length);
      assert.equal(
        open.every(
          (job) =>
            job.title === title.title &&
            job.title_id === title.title_id &&
            job.date_posted === today &&
            job.valid_through === today &&
            job.referencenumber.startsWith(
              `HTL-${job.postalcode}-${today.replaceAll("-", "")}-${title.title_id}-`,
            ),
        ),
        true,
      );
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
