"use client";

import { Button } from "@/components/ui/button";

export function DownloadButton({ href }: { href: string }) {
  return (
    <Button
      nativeButton={false}
      size="xl"
      render={<a href={href} />}
      className="w-full md:w-auto md:min-w-72"
    >
      Download the Hetal app
    </Button>
  );
}
