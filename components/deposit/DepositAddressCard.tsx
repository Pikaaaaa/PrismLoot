"use client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function DepositAddressCard({
  label,
  address,
  className,
  showStepHeader = true,
}: {
  label: string;
  address: string;
  className?: string;
  showStepHeader?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const qrSrc = address ? `/api/deposit/qr?text=${encodeURIComponent(address)}` : "";

  async function copy() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className={cn("rounded-[var(--radius-md)] border border-line bg-graphite p-3 sm:p-4", className)}>
      {showStepHeader ? <p className="label mb-3">3. Confirm deposit details</p> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <div className="mx-auto shrink-0 rounded-[var(--radius-sm)] border border-line bg-white p-2 sm:mx-0">
          {qrSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrSrc} alt="" width={168} height={168} className="block h-[8.5rem] w-[8.5rem]" />
          ) : (
            <div className="grid h-[8.5rem] w-[8.5rem] place-items-center bg-void/5 text-xs text-mute">No address</div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          <p className="label">{label}</p>
          <div className="flex min-w-0 flex-col gap-2 rounded-[var(--radius-sm)] border border-line bg-panel px-3 py-2.5 sm:flex-row sm:items-start">
            <p className="min-w-0 flex-1 break-all font-mono text-[0.8125rem] leading-relaxed text-ink">{address}</p>
            <Button
              size="sm"
              variant="ghost"
              className="min-h-10 w-full shrink-0 sm:min-h-8 sm:w-auto"
              icon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              onClick={() => void copy()}
              aria-label="Copy address"
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
