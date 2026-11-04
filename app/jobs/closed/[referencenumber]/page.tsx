import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClosedJob } from "@/components/job-view";
import { JobsError } from "@/components/jobs-error";
import { JobsDataError } from "@/lib/config";
import { findJob, openJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";

type ClosedPageProps = {
  params: Promise<{ referencenumber: string }>;
};

export async function generateMetadata({ params }: ClosedPageProps): Promise<Metadata> {
  const { referencenumber } = await params;
  try {
    const job = findJob(referencenumber);
    if (!job || job.status !== "closed") {
      return { title: "Job not found", robots: { index: false, follow: false } };
    }
  } catch {
    return { title: "Job", robots: { index: false, follow: false } };
  }
  return {
    title: "This job is no longer available",
    robots: { index: false, follow: true },
  };
}

export default async function ClosedJobPage({ params }: ClosedPageProps) {
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
  if (!job || job.status !== "closed") notFound();
  let stillOpen;
  try {
    stillOpen = openJobs();
  } catch (error) {
    if (error instanceof JobsDataError) {
      return <JobsError message={error.message} />;
    }
    throw error;
  }
  return <ClosedJob job={job} openJobs={stillOpen} />;
}
