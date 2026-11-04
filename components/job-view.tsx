import Link from "next/link";

import { DownloadButton } from "@/components/download-button";
import { formatJobType } from "@/lib/format";
import { buildJobPosting, serializeJsonLd } from "@/lib/jsonld";
import { buildOnelink } from "@/lib/onelink";
import type { Job } from "@/lib/types";
import { jobPath } from "@/lib/urls";

export function JobList({ jobs }: { jobs: Job[] }) {
  if (jobs.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-border bg-card px-5 py-8">
        <h2 className="font-display text-2xl font-semibold">No open audits right now</h2>
        <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
          Check back soon. New visits appear here when they are marked open.
        </p>
      </div>
    );
  }

  return (
    <ul className="mt-8 flex flex-col gap-3">
      {jobs.map((job) => (
        <li key={job.referencenumber}>
          <Link
            href={jobPath(job.referencenumber)}
            className="block rounded-2xl border border-border bg-card px-4 py-4 transition-colors hover:border-primary/50"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-mono text-sm font-medium text-primary">{job.postalcode}</p>
              <p className="text-sm text-muted-foreground">{formatJobType(job.jobtype)}</p>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {job.city}, {job.state}
            </p>
            <h2 className="mt-1 font-display text-[1.65rem] leading-tight font-semibold">
              {job.title}
            </h2>
            <p className="mt-3 font-display text-2xl font-semibold">{job.pay}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function OpenJob({ job, siteUrl }: { job: Job; siteUrl: string }) {
  const applyUrl = buildOnelink(job);
  const jsonLd = serializeJsonLd(buildJobPosting(job, siteUrl));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 pt-6 pb-10 md:pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <p className="text-sm text-muted-foreground">
        {job.city}, {job.state}
        <span aria-hidden="true"> · </span>
        <span className="font-mono text-base font-medium text-foreground">{job.postalcode}</span>
      </p>
      <h1 className="mt-2 max-w-xl font-display text-[2.15rem] leading-[1.1] font-semibold tracking-tight text-balance">
        {job.title}
      </h1>
      <p className="mt-6 text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
        Pay
      </p>
      <p className="font-display text-[2.75rem] leading-none font-semibold tracking-tight">
        {job.pay}
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        {formatJobType(job.jobtype)} · Posted {job.date_posted}
      </p>
      <div className="cta-dock mt-6">
        <DownloadButton href={applyUrl} />
        <p className="mt-2 text-center text-xs leading-5 text-muted-foreground md:text-left">
          Apply in the Hetal app. This page does not ask you to sign in.
        </p>
      </div>
      <div
        className="job-copy mt-8 border-t border-border pt-6"
        data-job-description
        dangerouslySetInnerHTML={{ __html: job.description_html }}
      />
    </main>
  );
}

export function ClosedJob({ job, openJobs }: { job: Job; openJobs: Job[] }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
      <p className="font-mono text-sm font-medium text-primary">{job.postalcode}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {job.city}, {job.state}
      </p>
      <h1 className="mt-4 max-w-xl font-display text-4xl leading-tight font-semibold tracking-tight">
        This job is no longer available
      </h1>
      <p className="mt-4 max-w-xl text-lg leading-7">
        {job.title} in {job.city}, {job.state} has ended. It may have been filled or removed.
      </p>
      <div className="mt-10">
        <h2 className="font-display text-2xl font-semibold">Open audits</h2>
        <JobList jobs={openJobs} />
      </div>
    </main>
  );
}
