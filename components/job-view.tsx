import Link from "next/link";

import { formatJobType, formatLongDate } from "@/lib/format";
import { buildJobPosting, serializeJsonLd } from "@/lib/jsonld";
import { buildOnelink } from "@/lib/onelink";
import type { Job } from "@/lib/types";
import { jobPath } from "@/lib/urls";

export function JobList({ jobs }: { jobs: Job[] }) {
  if (jobs.length === 0) {
    return (
      <div className="mt-6 border border-border bg-card px-4 py-6">
        <p className="text-lg font-semibold">No open audits right now.</p>
        <p className="mt-2">Check back soon. New visits show up here when they are marked open.</p>
      </div>
    );
  }

  return (
    <ul className="mt-5 flex flex-col gap-3">
      {jobs.map((job) => (
        <li key={job.referencenumber}>
          <Link
            href={jobPath(job.referencenumber)}
            className="block border border-border bg-card px-4 py-4 text-foreground no-underline hover:border-foreground"
          >
            <span className="block text-xl leading-tight font-semibold">{job.title}</span>
            <span className="mt-3 inline-block bg-primary px-2 py-1 text-lg leading-none font-semibold text-primary-foreground">
              {job.pay}
            </span>
            <span className="mt-3 block">
              {job.city}, {job.state} {job.postalcode}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              {formatJobType(job.jobtype)} · Posted {formatLongDate(job.date_posted)}
            </span>
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
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <p className="text-[0.8rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        Open visit
      </p>
      <h1 className="mt-2 text-[2rem] leading-tight font-semibold tracking-tight">{job.title}</h1>
      <p className="mt-4 inline-block bg-primary px-3 py-2 text-[2.5rem] leading-none font-semibold tracking-tight text-primary-foreground">
        {job.pay}
      </p>
      <p className="mt-4 text-lg">
        {job.city}, {job.state} <span translate="no">{job.postalcode}</span>
        <span className="text-muted-foreground"> · United States</span>
      </p>
      <div className="mt-5">
        <a
          href={applyUrl}
          className="inline-flex h-14 w-full items-center justify-center bg-primary px-4 text-center text-base font-semibold text-primary-foreground hover:bg-[#e6c43a]"
        >
          Download the Hetal app
        </a>
        <p className="mt-2 text-sm text-muted-foreground">
          Opens the Hetal app download. You will reserve this visit there.
        </p>
      </div>
      <div
        className="job-description mt-8 text-[1.0625rem] leading-7"
        data-job-description
        dangerouslySetInnerHTML={{ __html: job.description_html }}
      />
      <p className="mt-8 text-sm text-muted-foreground">
        {formatJobType(job.jobtype)} · Posted {formatLongDate(job.date_posted)}. Reference{" "}
        <span translate="no">{job.referencenumber}</span>.
      </p>
    </article>
  );
}

export function ClosedJob({ job, openJobs }: { job: Job; openJobs: Job[] }) {
  return (
    <article>
      <p className="text-[0.8rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        Closed
      </p>
      <h1 className="mt-2 text-[2rem] leading-tight font-semibold tracking-tight">{job.title}</h1>
      <p className="mt-5 border border-border bg-card px-4 py-4 text-[1.35rem] leading-snug font-semibold">
        This job is no longer available
      </p>
      <p className="mt-4 text-lg">
        {job.city}, {job.state} <span translate="no">{job.postalcode}</span>
        <span className="text-muted-foreground"> · United States</span>
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Posted {formatLongDate(job.date_posted)}. Reference{" "}
        <span translate="no">{job.referencenumber}</span>.
      </p>
      <div className="mt-8">
        <h2 className="text-2xl font-semibold">Open audits</h2>
        <JobList jobs={openJobs} />
      </div>
    </article>
  );
}
