import crypto from "node:crypto";

import type { Job } from "./types";
import { jobCanonicalUrl } from "./urls";

export type IndexingAction = "published" | "updated" | "deleted";

export type IndexingNotice = {
  action: IndexingAction;
  type: "URL_UPDATED" | "URL_DELETED";
  referencenumber: string;
  url: string;
};

export type IndexingState = {
  jobs: Record<string, { hash: string }>;
};

export type IndexingCredentials = {
  email: string;
  privateKey: string;
};

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const PUBLISH_URL = "https://indexing.googleapis.com/v3/urlNotifications:publish";

export function jobContentHash(job: Job): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        title: job.title,
        description_html: job.description_html,
        pay: job.pay,
        city: job.city,
        state: job.state,
        postalcode: job.postalcode,
        country: job.country,
        date_posted: job.date_posted,
        valid_through: job.valid_through ?? "",
        jobtype: job.jobtype,
        status: job.status,
      }),
    )
    .digest("hex");
}

export function planIndexingNotices(
  jobs: Job[],
  previous: IndexingState,
  siteUrl: string,
): IndexingNotice[] {
  const notices: IndexingNotice[] = [];
  const byRef = new Map(jobs.map((job) => [job.referencenumber, job]));

  for (const job of jobs) {
    if (job.status !== "open") continue;
    const url = jobCanonicalUrl(siteUrl, job.referencenumber);
    const prior = previous.jobs[job.referencenumber];
    if (!prior) {
      notices.push({
        action: "published",
        type: "URL_UPDATED",
        referencenumber: job.referencenumber,
        url,
      });
    } else if (prior.hash !== jobContentHash(job)) {
      notices.push({
        action: "updated",
        type: "URL_UPDATED",
        referencenumber: job.referencenumber,
        url,
      });
    }
  }

  for (const referencenumber of Object.keys(previous.jobs)) {
    const job = byRef.get(referencenumber);
    if (job?.status === "open") continue;
    notices.push({
      action: "deleted",
      type: "URL_DELETED",
      referencenumber,
      url: jobCanonicalUrl(siteUrl, referencenumber),
    });
  }

  return notices;
}

export function noticeForAction(
  jobs: Job[],
  referencenumber: string,
  action: IndexingAction,
  siteUrl: string,
): IndexingNotice {
  const job = jobs.find((item) => item.referencenumber === referencenumber);
  const url = jobCanonicalUrl(siteUrl, referencenumber);
  if (action === "deleted") {
    if (job?.status === "open") {
      throw new Error(
        `${referencenumber} is still open. Close it and return 410 before sending URL_DELETED.`,
      );
    }
    return { action, type: "URL_DELETED", referencenumber, url };
  }
  if (!job || job.status !== "open") {
    throw new Error(`${referencenumber} is not an open job, so it cannot be ${action}.`);
  }
  return { action, type: "URL_UPDATED", referencenumber, url };
}

export function stateAfterNotices(
  jobs: Job[],
  previous: IndexingState,
  notices: IndexingNotice[],
  succeeded: Set<string>,
): IndexingState {
  const next: IndexingState = { jobs: { ...previous.jobs } };
  const byRef = new Map(jobs.map((job) => [job.referencenumber, job]));
  for (const notice of notices) {
    if (!succeeded.has(notice.referencenumber)) continue;
    if (notice.type === "URL_DELETED") {
      delete next.jobs[notice.referencenumber];
      continue;
    }
    const job = byRef.get(notice.referencenumber);
    if (job) next.jobs[notice.referencenumber] = { hash: jobContentHash(job) };
  }
  return next;
}

export function indexingCredentialsFromEnv(
  env: Record<string, string | undefined> = process.env,
): IndexingCredentials | undefined {
  const email = env.GOOGLE_INDEXING_CLIENT_EMAIL?.trim();
  const rawKey = env.GOOGLE_INDEXING_PRIVATE_KEY?.trim();
  if (!email && !rawKey) return undefined;
  if (!email || !rawKey) {
    throw new Error(
      "Set both GOOGLE_INDEXING_CLIENT_EMAIL and GOOGLE_INDEXING_PRIVATE_KEY, or neither.",
    );
  }
  const privateKey = rawKey.replace(/\\n/g, "\n");
  if (!email.endsWith(".gserviceaccount.com")) {
    throw new Error("GOOGLE_INDEXING_CLIENT_EMAIL must be a Google service account address.");
  }
  if (!privateKey.includes("BEGIN PRIVATE KEY")) {
    throw new Error("GOOGLE_INDEXING_PRIVATE_KEY must be a PEM private key.");
  }
  return { email, privateKey };
}

export function signIndexingJwt(credentials: IndexingCredentials, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: credentials.email,
      scope: "https://www.googleapis.com/auth/indexing",
      aud: TOKEN_URL,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsigned), credentials.privateKey);
  return `${unsigned}.${signature.toString("base64url")}`;
}

function base64url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

export async function fetchIndexingAccessToken(credentials: IndexingCredentials): Promise<string> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signIndexingJwt(credentials),
    }),
  });
  const payload = (await response.json()) as { access_token?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(`Google token request failed (${response.status}).`);
  }
  return payload.access_token;
}

export async function publishIndexingNotice(
  accessToken: string,
  notice: IndexingNotice,
): Promise<void> {
  const response = await fetch(PUBLISH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: notice.url, type: notice.type }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Indexing API ${notice.type} for ${notice.url} failed (${response.status}): ${text.slice(0, 400)}`,
    );
  }
}
