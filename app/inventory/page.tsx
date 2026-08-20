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
        description="Every drop stays listed. Sell, stake, or withdraw live skins — sold and used items keep a status."
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
