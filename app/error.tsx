"use client";

import { Button } from "@/components/ui/Button";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import Link from "next/link";

export default function ErrorState({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="surface surface-pad mx-auto w-full max-w-md text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-danger/25 bg-danger/10">
          <AlertTriangle className="h-5 w-5 text-danger" />
        </div>
        <h1>Something glitched</h1>
        <p className="mt-2 text-sm text-mute">
          Something unexpected happened. Retrying usually clears it.
        </p>
        {error?.message ? (
          <p className="mt-3 truncate rounded-[var(--radius-sm)] border border-line bg-graphite px-3 py-2 font-mono text-xs text-mute">
            {error.message}
          </p>
        ) : null}
        <div className="mt-5 flex items-center justify-center gap-2">
          <Button onClick={reset} icon={<RotateCcw className="h-4 w-4" />}>
            Retry
          </Button>
          <Link href="/">
            <Button variant="ghost" icon={<Home className="h-4 w-4" />}>
              Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
