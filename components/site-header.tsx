import Link from "next/link";

export function SiteHeader({ companyName }: { companyName: string }) {
  const mark = companyName.trim().slice(0, 1).toUpperCase() || "H";

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="flex items-center gap-2.5 rounded-md">
          <span
            aria-hidden
            className="grid size-9 place-items-center rounded-md bg-primary font-display text-lg text-primary-foreground"
          >
            {mark}
          </span>
          <span className="font-display text-lg leading-none font-semibold tracking-tight">
            {companyName}
          </span>
        </Link>
        <p className="text-sm text-muted-foreground">Store audits</p>
      </div>
    </header>
  );
}
