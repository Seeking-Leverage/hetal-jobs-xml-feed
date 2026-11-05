import Link from "next/link";

export default function NotFound() {
  return (
    <div>
      <p className="eyebrow text-muted-foreground">Missing visit</p>
      <h1 className="mt-3 text-[2.25rem] leading-[1.15]">That job is not on this board</h1>
      <p className="mt-4 text-lg leading-7">
        The link may be mistyped, or this visit was never published.
      </p>
      <Link href="/" className="btn mt-6">
        See open audits
      </Link>
    </div>
  );
}
