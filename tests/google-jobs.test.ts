import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import sampleJobs from "../fixtures/sample-jobs.json";
import { ClosedJob, OpenJob } from "../components/job-view";
import { jobPostingIssues, validThroughTimestamp } from "../lib/jsonld";
import { parseJobs } from "../lib/jobs";
import {
  indexingCredentialsFromEnv,
  jobContentHash,
  noticeForAction,
  planIndexingNotices,
  signIndexingJwt,
  stateAfterNotices,
  type IndexingState,
} from "../lib/indexing";
import { sitemapJobUrls } from "../lib/urls";
import type { Job } from "../lib/types";

const sample = parseJobs(sampleJobs);
const nashua = sample.find((job) => job.postalcode === "03060");
const cambridge = sample.find((job) => job.status === "closed");
const site = "https://jobs.hetalretail.com";

describe("Google JobPosting", () => {
  it("includes every required property and the permanent job URL", () => {
    assert.ok(nashua);
    const issues = jobPostingIssues(nashua, site);
    assert.deepEqual(issues, []);
    const expiring = { ...nashua, valid_through: "2026-11-08" };
    assert.deepEqual(jobPostingIssues(expiring, site), []);
    assert.equal(validThroughTimestamp("2026-11-08"), "2026-11-08T23:59:59-05:00");
    assert.equal(validThroughTimestamp("2026-07-15"), "2026-07-15T23:59:59-04:00");
  });

  it("puts JobPosting only on an open job page", () => {
    assert.ok(nashua);
    assert.ok(cambridge);
    const openHtml = renderToStaticMarkup(
      OpenJob({ job: nashua, siteUrl: site }),
    );
    const blocks = openHtml.match(/application\/ld\+json/g) ?? [];
    assert.equal(blocks.length, 1);
    assert.equal(openHtml.includes(nashua.referencenumber), true);
    assert.equal(openHtml.includes("baseSalary"), false);
    const closedHtml = renderToStaticMarkup(
      ClosedJob({ job: cambridge, openJobs: [nashua] }),
    );
    assert.equal(closedHtml.includes("application/ld+json"), false);
    assert.equal(closedHtml.includes("This job is no longer available"), true);
    assert.equal(closedHtml.includes("onelink.me"), false);
  });
});

describe("sitemap", () => {
  it("lists open jobs and leaves closed jobs out", () => {
    assert.ok(nashua);
    assert.ok(cambridge);
    const urls = sitemapJobUrls(sample, site);
    assert.equal(urls.length, 3);
    assert.equal(
      urls.includes(`${site}/jobs/${nashua.referencenumber}`),
      true,
    );
    assert.equal(urls.some((url) => url.includes(cambridge.referencenumber)), false);
    assert.equal(urls.some((url) => url.includes("?")), false);
  });
});

describe("Indexing API notices", () => {
  function live(overrides: Partial<Job> = {}): Job {
    assert.ok(nashua);
    return { ...nashua, ...overrides };
  }

  it("publishes a new job, updates a changed job, and deletes a closed job", () => {
    const original = live();
    const previous: IndexingState = {
      jobs: {
        [original.referencenumber]: { hash: jobContentHash(original) },
        "HTL-02139-20260915-store-auditor-01": { hash: "old" },
      },
    };
    const changed = live({ title: "Retail Merchandiser" });
    const added = live({
      referencenumber: "HTL-07094-20261102-retail-merchandiser-01",
      postalcode: "07094",
      title: "Retail Merchandiser",
      title_id: "retail-merchandiser",
    });
    const notices = planIndexingNotices([changed, added], previous, site);
    assert.deepEqual(
      notices.map((notice) => [notice.action, notice.type, notice.referencenumber]),
      [
        ["updated", "URL_UPDATED", original.referencenumber],
        ["published", "URL_UPDATED", added.referencenumber],
        ["deleted", "URL_DELETED", "HTL-02139-20260915-store-auditor-01"],
      ],
    );
    assert.equal(notices[0].url, `${site}/jobs/${original.referencenumber}`);
    assert.equal(notices[2].url.includes("?"), false);

    const succeeded = new Set(notices.map((notice) => notice.referencenumber));
    const next = stateAfterNotices([changed, added], previous, notices, succeeded);
    assert.equal(next.jobs[original.referencenumber].hash, jobContentHash(changed));
    assert.equal(next.jobs[added.referencenumber].hash, jobContentHash(added));
    assert.equal(next.jobs["HTL-02139-20260915-store-auditor-01"], undefined);

    const again = planIndexingNotices([changed, added], next, site);
    assert.deepEqual(again, []);
  });

  it("refuses to delete a job that is still open", () => {
    assert.ok(nashua);
    assert.throws(
      () => noticeForAction([nashua], nashua.referencenumber, "deleted", site),
      /still open/,
    );
    const deleted = noticeForAction([nashua], "HTL-02139-20260915-store-auditor-01", "deleted", site);
    assert.equal(deleted.type, "URL_DELETED");
  });

  it("signs an Indexing API JWT and ignores missing credentials", () => {
    assert.equal(indexingCredentialsFromEnv({ NODE_ENV: "test" }), undefined);
    const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const email = "jobs@example.iam.gserviceaccount.com";
    const token = signIndexingJwt({ email, privateKey: pem }, 1_700_000_000);
    const [encodedHeader, encodedPayload, signature] = token.split(".");
    const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString()) as { alg: string };
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString()) as {
      iss: string;
      scope: string;
      aud: string;
    };
    assert.equal(header.alg, "RS256");
    assert.equal(payload.iss, email);
    assert.equal(payload.scope, "https://www.googleapis.com/auth/indexing");
    assert.equal(payload.aud, "https://oauth2.googleapis.com/token");
    const valid = crypto.verify(
      "RSA-SHA256",
      Buffer.from(`${encodedHeader}.${encodedPayload}`),
      publicKey,
      Buffer.from(signature, "base64url"),
    );
    assert.equal(valid, true);
    assert.equal(token.includes(pem), false);
  });
});
