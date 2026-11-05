export function JobsError({ message }: { message: string }) {
  return (
    <div>
      <p className="eyebrow text-destructive">Jobs file</p>
      <h1 className="mt-3 text-[2.25rem] leading-[1.15]">The job list could not be read</h1>
      <p role="alert" className="mt-4 text-lg leading-7">
        {message}
      </p>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        Fix data/jobs.json and reload. The Indeed feed stays offline until the file is valid.
      </p>
    </div>
  );
}
