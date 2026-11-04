import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12">
      <p className="text-sm font-medium tracking-[0.14em] text-primary uppercase">Missing visit</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">
        That job is not on this board
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
        The link may be mistyped, or this visit was never published.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground"
      >
        See open audits
      </Link>
    </main>
  );
}
