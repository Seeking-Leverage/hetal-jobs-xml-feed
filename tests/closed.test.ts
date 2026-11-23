import assert from "node:assert/strict";
import { describe, it } from "node:test";

import closedRefs from "../data/closed-refs.json";
import { closedJobRewrite, closedReferencenumbers } from "../lib/closed";
import { loadJobs } from "../lib/jobs";

describe("closed job rewrite", () => {
  it("rewrites a closed reference and leaves an open one alone", () => {
    const closed = new Set(["HTL-03060-20261105-mystery-shopper-01"]);
    assert.equal(
      closedJobRewrite("/HTL-03060-20261105-mystery-shopper-01", "", closed),
      "/closed/HTL-03060-20261105-mystery-shopper-01?__closed=1",
    );
    assert.equal(closedJobRewrite("/HTL-35810-20261122-flexible-gig-shelf-auditor-01", "", closed), null);
    assert.equal(closedJobRewrite("/jobs", "", closed), null);
  });

  it("matches the closed jobs in jobs.json", () => {
    const jobs = loadJobs();
    assert.deepEqual(closedRefs, closedReferencenumbers(jobs));
    assert.ok(closedRefs.length > 0);
  });
});
