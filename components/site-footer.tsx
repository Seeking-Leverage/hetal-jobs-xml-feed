import { getCompanyName } from "@/lib/config";
import { mountPath } from "@/lib/urls";

export function SiteFooter() {
  const companyName = getCompanyName();

  return (
    <footer className="bg-foreground text-background">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-12 sm:flex-row sm:items-end sm:justify-between">
        <nav className="flex flex-col items-start gap-4" aria-label="Hetal">
          <a className="footer-link" href="https://www.hetalretail.com/become-a-hetalite">
            Become a Hetalite
          </a>
          <a className="footer-link" href="https://www.hetalretail.com">
            {companyName}
          </a>
          <a className="footer-link" href="mailto:support@hetalretail.com">
            support@hetalretail.com
          </a>
          <a className="footer-link" href={`${mountPath()}/feed.xml`}>
            Job feed
          </a>
        </nav>
        <p className="text-sm">© {new Date().getFullYear()} - Hetal</p>
      </div>
    </footer>
  );
}
