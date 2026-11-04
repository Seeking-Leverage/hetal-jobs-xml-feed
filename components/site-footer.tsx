export function SiteFooter({ companyName }: { companyName: string }) {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-5 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>{companyName} hires Hetalites for on-demand store audits.</p>
        <a href="/feed.xml" className="font-medium text-foreground underline-offset-4 hover:underline">
          Indeed job feed
        </a>
      </div>
    </footer>
  );
}
