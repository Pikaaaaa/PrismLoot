import { UpgradePanel } from "@/components/upgrade/UpgradePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { Suspense } from "react";

export default function UpgradePage() {
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Upgrade" />
      <Suspense fallback={<PageSkeleton />}>
        <UpgradePanel />
      </Suspense>
    </div>
  );
}
