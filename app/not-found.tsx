import Link from "next/link";

export default function NotFound() {
  return (
    <div>
      <p className="text-[0.8rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        Missing visit
      </p>
      <h1 className="mt-2 text-[2rem] leading-tight font-semibold tracking-tight">
        That job is not on this board
      </h1>
      <p className="mt-4 text-lg leading-7">
        The link may be mistyped, or this visit was never published.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-14 w-full items-center justify-center bg-primary px-4 text-base font-semibold text-primary-foreground hover:bg-[#e6c43a]"
      >
        See open audits
      </Link>
    </div>
  );
}
