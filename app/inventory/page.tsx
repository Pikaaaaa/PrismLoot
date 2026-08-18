"use client";

import { InventoryVault } from "@/components/inventory/InventoryVault";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Package, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";

export default function InventoryPage() {
  const router = useRouter();
  return (
    <div className="page-stack">
      <PageHeader
        kicker="Vault"
        title="Inventory"
        description="Every skin you own. Sell, stake in an upgrade, feed a contract, or request a withdrawal."
        actions={
          <>
            <Button
              variant="ghost"
              icon={<UserRound className="h-4 w-4" />}
              onClick={() => router.push("/profile")}
            >
              Profile
            </Button>
            <Button icon={<Package className="h-4 w-4" />} onClick={() => router.push("/cases")}>
              Open a case
            </Button>
          </>
        }
      />
      <InventoryVault />
    </div>
  );
}
