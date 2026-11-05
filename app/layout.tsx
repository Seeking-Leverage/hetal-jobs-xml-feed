import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCompanyName } from "@/lib/config";

import "./globals.css";

const sans = localFont({
  src: [{ path: "../public/fonts/PPFragment-SansRegular.otf", weight: "400", style: "normal" }],
  variable: "--font-app-sans",
  display: "swap",
  adjustFontFallback: "Arial",
  fallback: ["Arial", "sans-serif"],
});

const heading = localFont({
  src: [{ path: "../public/fonts/PPFragment-GlareRegular.otf", weight: "400", style: "normal" }],
  variable: "--font-app-heading",
  display: "swap",
  adjustFontFallback: "Arial",
  fallback: ["Arial", "sans-serif"],
});

export const viewport: Viewport = {
  themeColor: "#fffcf2",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata(): Promise<Metadata> {
  const company = getCompanyName();
  return {
    title: {
      default: "Open store audits",
      template: `%s | ${company}`,
    },
    description: `Open ${company} store audits for Hetalites. See the pay, the city, and what the visit involves, then download the Hetal app.`,
    applicationName: company,
    openGraph: {
      siteName: company,
      type: "website",
      locale: "en_US",
    },
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${heading.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        <SiteHeader />
        <main id="content" className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
