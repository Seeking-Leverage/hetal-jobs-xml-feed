import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCompanyName } from "@/lib/config";
import { Fraunces, Outfit } from "next/font/google";

import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["400", "500", "600", "700"],
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

export async function generateMetadata(): Promise<Metadata> {
  const company = getCompanyName();
  return {
    title: {
      default: "Open store audits",
      template: `%s · ${company}`,
    },
    description: `On-demand store audits with ${company}. Read an open visit, then download the Hetal app to claim it.`,
  };
}

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  const companyName = getCompanyName();

  return (
    <html lang="en" className={`${outfit.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <SiteHeader companyName={companyName} />
        <div id="content" className="flex flex-1 flex-col">
          {children}
        </div>
        <SiteFooter companyName={companyName} />
      </body>
    </html>
  );
}
