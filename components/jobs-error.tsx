export function JobsError({ message }: { message: string }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12">
      <p className="text-sm font-medium tracking-[0.14em] text-destructive uppercase">
        Jobs file
      </p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">
        The job list could not be read
      </h1>
      <p role="alert" className="mt-4 max-w-xl text-base leading-7">
        {message}
      </p>
      <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
        Fix data/jobs.json and reload. The Indeed feed stays offline until the file is valid.
      </p>
    </main>
  );
}
