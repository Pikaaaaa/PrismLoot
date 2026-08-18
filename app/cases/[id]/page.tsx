"use client";

import { CaseOpen } from "@/components/case/CaseOpen";
import { Button } from "@/components/ui/Button";
import { CASE_MAP } from "@/lib/mock-data";
import { Compass, Home } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function CasePage() {
  const { id } = useParams<{ id: string }>();
  const crate = CASE_MAP[id];
  if (!crate) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="surface surface-pad mx-auto w-full max-w-md text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-line bg-graphite">
            <Compass className="h-5 w-5 text-mute" />
          </div>
          <p className="label">Error 404</p>
          <h1 className="mt-1">Case not found</h1>
          <p className="mt-2 text-sm text-mute">This crate id is not in the catalog.</p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <Link href="/">
              <Button icon={<Home className="h-4 w-4" />}>Return home</Button>
            </Link>
            <Link href="/cases">
              <Button variant="ghost">Browse cases</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }
  return <CaseOpen crate={crate} />;
}
