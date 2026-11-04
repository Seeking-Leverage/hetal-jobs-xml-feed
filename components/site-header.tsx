import Image from "next/image";
import Link from "next/link";

import { getCompanyName } from "@/lib/config";

export function SiteHeader() {
  const companyName = getCompanyName();

  return (
    <header className="bg-foreground text-background">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-4 px-4 py-3.5">
        <Link href="/" className="block">
          <Image
            src="/hetal-logo.png"
            alt={companyName}
            width={170}
            height={28}
            priority
            className="h-7 w-auto invert"
          />
        </Link>
        <Link href="/" className="text-[0.95rem] font-semibold text-background">
          Open audits
        </Link>
      </div>
      <div className="h-1 bg-primary" aria-hidden="true" />
    </header>
  );
}
