import { JobsError } from "@/components/jobs-error";
import { JobList } from "@/components/job-view";
import { JobsDataError } from "@/lib/config";
import { openJobs } from "@/lib/jobs";
import type { Job } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function HomePage() {
  let jobs: Job[] | undefined;
  let errorMessage: string | null = null;
  try {
    jobs = openJobs();
  } catch (error) {
    errorMessage =
      error instanceof JobsDataError
        ? error.message
        : "Something went wrong while reading the job list.";
  }
  if (errorMessage || !jobs) {
    return <JobsError message={errorMessage ?? "Something went wrong while reading the job list."} />;
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">Hetalites</p>
      <h1 className="mt-2 max-w-xl font-display text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
        Open store audits
      </h1>
      <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
        Pick a city, read the visit, then download the Hetal app to claim it. Pay is listed on
        every posting.
      </p>
      <p className="mt-6 text-sm text-muted-foreground">
        {jobs.length === 1 ? "1 open visit" : `${jobs.length} open visits`}
      </p>
      <JobList jobs={jobs} />
    </main>
  );
}
