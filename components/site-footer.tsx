import { getCompanyName } from "@/lib/config";

export function SiteFooter() {
  const companyName = getCompanyName();

  return (
    <footer className="mx-auto w-full max-w-xl px-4 pt-2 pb-10 text-sm text-muted-foreground">
      <div className="border-t border-border pt-6">
        <p>{companyName} hires Hetalites for on-demand store audits.</p>
        <p className="mt-2">
          <a className="text-foreground underline underline-offset-2" href="mailto:support@hetalretail.com">
            support@hetalretail.com
          </a>
        </p>
        <p className="mt-1">
          <a className="text-foreground underline underline-offset-2" href="https://www.hetalretail.com">
            hetalretail.com
          </a>
        </p>
        <p className="mt-1">
          <a className="text-foreground underline underline-offset-2" href="/feed.xml">
            Indeed job feed
          </a>
        </p>
      </div>
    </footer>
  );
}
