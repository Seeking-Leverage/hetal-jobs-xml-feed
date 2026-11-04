export function JobsError({ message }: { message: string }) {
  return (
    <div>
      <p className="text-[0.8rem] font-semibold tracking-[0.14em] text-destructive uppercase">
        Jobs file
      </p>
      <h1 className="mt-2 text-[2rem] leading-tight font-semibold tracking-tight">
        The job list could not be read
      </h1>
      <p role="alert" className="mt-4 text-lg leading-7">
        {message}
      </p>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        Fix data/jobs.json and reload. The Indeed feed stays offline until the file is valid.
      </p>
    </div>
  );
}
