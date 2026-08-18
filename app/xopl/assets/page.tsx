import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { caseArtPaths } from "@/lib/case-art";
import { listCaseAssetFolders, validateCaseAssets } from "@/lib/validate-case-assets";
import Image from "next/image";

export default function CaseAssetsAdminPage() {
  const report = validateCaseAssets();
  const samples = listCaseAssetFolders()
    .filter((id) => id !== "_fallback")
    .slice(0, 8)
    .map((id) => ({ id, ...caseArtPaths(id) }));

  return (
    <div className="page-stack">
      <PageHeader
        kicker="Developer"
        title="Case artwork"
        description="Every crate needs a unique 3D case image, thumbnail, and opening background on disk."
      />
      <div className="surface surface-pad">
        <p className="price">{report.log}</p>
        <p className={`mt-2 text-sm ${report.ok ? "text-cyan" : "text-danger"}`}>
          {report.ok ? "All case kits are present and unique." : "Fix missing or duplicated files before shipping."}
        </p>
        <p className="meta mt-1">
          Thumbnails {report.thumbnails} · Backgrounds {report.backgrounds} · Sample {report.sample.map((s) => s.image).join(", ")}
        </p>
      </div>
      {report.issues.length > 0 && (
        <div className="surface overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-graphite text-xs uppercase text-mute">
              <tr>
                <th className="p-3">Case</th>
                <th>Field</th>
                <th>Reason</th>
                <th>Path</th>
              </tr>
            </thead>
            <tbody>
              {report.issues.slice(0, 80).map((issue, i) => (
                <tr key={`${issue.caseId}-${issue.field}-${i}`} className="border-t border-line">
                  <td className="p-3 font-semibold">{issue.caseId}</td>
                  <td>{issue.field}</td>
                  <td>{issue.reason}</td>
                  <td className="meta">{issue.path}{issue.detail ? ` · ${issue.detail}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <SectionHeading title="Preview" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {samples.map((row) => (
          <div key={row.id} className="surface p-3">
            <div className="relative h-40 overflow-hidden rounded-[var(--radius-md)] bg-graphite">
              <Image src={row.thumbnail} alt={`${row.id} crate`} fill unoptimized className="object-contain" />
            </div>
            <p className="mt-2 text-sm font-semibold">{row.id}</p>
            <p className="meta truncate">{row.thumbnail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
