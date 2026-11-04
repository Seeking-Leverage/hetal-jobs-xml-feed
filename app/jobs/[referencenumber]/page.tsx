import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";

import { JobsError } from "@/components/jobs-error";
import { OpenJob } from "@/components/job-view";
import { JobsDataError, siteUrlFrom } from "@/lib/config";
import { findJob } from "@/lib/jobs";

export const dynamic = "force-dynamic";

type JobPageProps = {
  params: Promise<{ referencenumber: string }>;
};

export async function generateMetadata({ params }: JobPageProps): Promise<Metadata> {
  try {
    const { referencenumber } = await params;
    const job = findJob(referencenumber);
    if (!job || job.status !== "open") {
      return { title: "Job", robots: { index: false, follow: false } };
    }
    const headerList = await headers();
    const siteUrl = siteUrlFrom(headerList);
    return {
      title: job.title,
      description: `${job.title} in ${job.city}, ${job.state} ${job.postalcode}. ${job.pay}.`,
      alternates: {
        canonical: new URL(`/jobs/${encodeURIComponent(job.referencenumber)}`, siteUrl).toString(),
      },
      robots: { index: true, follow: true },
    };
  } catch {
    return { title: "Job" };
  }
}

export default async function JobPage({ params }: JobPageProps) {
  const { referencenumber } = await params;
  let job;
  try {
    job = findJob(referencenumber);
  } catch (error) {
    if (error instanceof JobsDataError) {
      return <JobsError message={error.message} />;
    }
    throw error;
  }
  if (!job || job.status === "closed") notFound();
  const headerList = await headers();
  return <OpenJob job={job} siteUrl={siteUrlFrom(headerList)} />;
}
