import fs from "node:fs";
import path from "node:path";

import { loadLocalEnv } from "../lib/env-file";
import {
  fetchIndexingAccessToken,
  indexingCredentialsFromEnv,
  noticeForAction,
  planIndexingNotices,
  publishIndexingNotice,
  stateAfterNotices,
  type IndexingAction,
  type IndexingNotice,
  type IndexingState,
} from "../lib/indexing";
import { loadJobs } from "../lib/jobs";

const STATE_PATH = path.join(process.cwd(), "data", "indexing-state.json");

function readState(): IndexingState {
  if (!fs.existsSync(STATE_PATH)) return { jobs: {} };
  const parsed = JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) as IndexingState;
  if (!parsed || typeof parsed !== "object" || !parsed.jobs) return { jobs: {} };
  return parsed;
}

function argumentValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function noticesFromArgs(siteUrl: string): IndexingNotice[] {
  const jobs = loadJobs();
  const reference = argumentValue("--reference");
  const action = argumentValue("--action") as IndexingAction | undefined;
  if (reference || action) {
    if (!reference || !action || !["published", "updated", "deleted"].includes(action)) {
      throw new Error("Use --reference HTL-... together with --action published, updated, or deleted.");
    }
    return [noticeForAction(jobs, reference, action, siteUrl)];
  }
  return planIndexingNotices(jobs, readState(), siteUrl);
}

async function main() {
  loadLocalEnv();
  const dryRun = process.argv.includes("--dry-run");
  const siteUrl = process.env.SITE_URL?.trim().replace(/\/$/, "");
  if (!siteUrl || !siteUrl.startsWith("https://")) {
    throw new Error(
      "Set SITE_URL to the public https origin, such as https://www.hetalretail.com, before notifying Google.",
    );
  }

  const notices = noticesFromArgs(siteUrl);
  if (notices.length === 0) {
    console.log("No published, updated, or deleted jobs to send.");
    return;
  }

  for (const notice of notices) {
    console.log(`${dryRun ? "would send" : "send"} ${notice.action} ${notice.type} ${notice.url}`);
  }
  if (dryRun) return;

  const credentials = indexingCredentialsFromEnv();
  if (!credentials) {
    throw new Error(
      "Set GOOGLE_INDEXING_CLIENT_EMAIL and GOOGLE_INDEXING_PRIVATE_KEY in the environment. Do not commit them.",
    );
  }

  const token = await fetchIndexingAccessToken(credentials);
  const succeeded = new Set<string>();
  const failures: string[] = [];
  for (const notice of notices) {
    try {
      await publishIndexingNotice(token, notice);
      succeeded.add(notice.referencenumber);
      console.log(`ok ${notice.type} ${notice.url}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(message);
      console.error(message);
    }
  }

  const next = stateAfterNotices(loadJobs(), readState(), notices, succeeded);
  fs.writeFileSync(STATE_PATH, `${JSON.stringify(next, null, 2)}\n`);
  if (failures.length > 0) {
    throw new Error(`${failures.length} Indexing API request${failures.length === 1 ? "" : "s"} failed.`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
