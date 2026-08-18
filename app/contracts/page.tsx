import { ContractPanel } from "@/components/contract/ContractPanel";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ContractsPage() {
  return (
    <div className="page-stack">
      <PageHeader title="Contracts" />
      <ContractPanel />
    </div>
  );
}
