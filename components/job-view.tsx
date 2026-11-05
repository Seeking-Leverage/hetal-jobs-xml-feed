import Link from "next/link";

import type { Channel } from "@/lib/channels";
import { formatJobType, formatLongDate } from "@/lib/format";
import { buildJobPosting, serializeJsonLd } from "@/lib/jsonld";
import { buildOnelink } from "@/lib/onelink";
import type { Job } from "@/lib/types";
import { jobPath } from "@/lib/urls";

export function JobList({ jobs }: { jobs: Job[] }) {
  if (jobs.length === 0) {
    return (
      <div className="mt-6 border border-border bg-card px-4 py-6">
        <p className="font-heading text-lg">No open audits right now.</p>
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
            <span className="font-heading block text-xl leading-tight">{job.title}</span>
            <span className="font-heading mt-3 block text-lg leading-none">{job.pay}</span>
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

export function OpenJob({
  job,
  siteUrl,
  channel = "indeed",
}: {
  job: Job;
  siteUrl: string;
  channel?: Channel;
}) {
  const applyUrl = buildOnelink(job, channel);
  const jsonLd = serializeJsonLd(buildJobPosting(job, siteUrl));

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <p className="eyebrow text-muted-foreground">Open visit</p>
      <h1 className="mt-3 text-[2.25rem] leading-[1.15]">{job.title}</h1>
      <p className="font-heading mt-4 text-[2.5rem] leading-none">{job.pay}</p>
      <p className="mt-4 text-lg">
        {job.city}, {job.state} <span translate="no">{job.postalcode}</span>
        <span className="text-muted-foreground"> · United States</span>
      </p>
      <div className="mt-5">
        <a href={applyUrl} className="btn">
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
        {`${formatJobType(job.jobtype)} · Posted ${formatLongDate(job.date_posted)}${
          job.valid_through ? ` · Open through ${formatLongDate(job.valid_through)}` : ""
        }. Reference `}
        <span translate="no">{job.referencenumber}</span>.
      </p>
    </article>
  );
}

export function ClosedJob({ job, openJobs }: { job: Job; openJobs: Job[] }) {
  return (
    <article>
      <p className="eyebrow text-muted-foreground">Closed</p>
      <h1 className="mt-3 text-[2.25rem] leading-[1.15]">{job.title}</h1>
      <p className="mt-5 border border-border bg-card px-4 py-4 text-[1.35rem] leading-snug">
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
        <h2 className="text-2xl">Open audits</h2>
        <JobList jobs={openJobs} />
      </div>
    </article>
  );
}
