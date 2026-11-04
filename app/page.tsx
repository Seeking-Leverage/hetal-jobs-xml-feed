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
    <div>
      <h1 className="text-[2rem] leading-tight font-semibold tracking-tight">Open store audits</h1>
      <p className="mt-3 text-lg leading-7">
        See the pay and the city, then download the Hetal app to reserve the visit. Each listing is
        one store audit. No sign-in on this page.
      </p>
      <p className="mt-3 text-lg">
        {jobs.length} open {jobs.length === 1 ? "audit" : "audits"}.
      </p>
      <JobList jobs={jobs} />
    </div>
  );
}
