import { DepositCashier } from "@/components/deposit/DepositCashier";
import { Suspense } from "react";

export default function DepositPage() {
  return (
    <Suspense>
      <DepositCashier />
    </Suspense>
  );
}
