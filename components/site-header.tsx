import Image from "next/image";
import Link from "next/link";

import { getCompanyName } from "@/lib/config";

export function SiteHeader() {
  const companyName = getCompanyName();

  return (
    <header className="bg-background">
      <div className="mx-auto flex h-16 max-w-xl items-center justify-between gap-4 px-4 sm:h-20">
        <Link href="https://www.hetalretail.com" className="block">
          <Image
            src="/hetal-logo.png"
            alt={companyName}
            width={145}
            height={24}
            priority
            className="h-6 w-auto"
          />
        </Link>
        <Link href="/" className="nav-link">
          Open audits
        </Link>
      </div>
    </header>
  );
}
