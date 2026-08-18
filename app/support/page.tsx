"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAppStore } from "@/lib/store";
import { CheckCircle2, Send } from "lucide-react";
import { useState } from "react";

const TOPICS = ["Payments", "Missing item", "Battle dispute", "Account", "Other"];

export default function SupportPage() {
  const { toast } = useAppStore();
  const [sent, setSent] = useState(false);

  return (
    <div className="page-stack mx-auto max-w-xl">
      <PageHeader
        kicker="Help"
        title="Support"
        description="Tickets go to the PrismLoot desk."
      />

      {sent ? (
        <div className="surface surface-pad text-center">
          <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full border border-cyan/25 bg-cyan/10">
            <CheckCircle2 className="h-5 w-5 text-cyan" />
          </div>
          <p className="font-semibold">Ticket queued</p>
          <p className="mt-1 text-sm text-mute">Thanks. This would hit a real desk in production.</p>
          <Button variant="ghost" className="mt-4" onClick={() => setSent(false)}>
            Send another
          </Button>
        </div>
      ) : (
        <form
          className="surface surface-pad flex flex-col gap-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
            toast({ title: "Message sent", tone: "ok" });
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="label">Email</span>
            <input required type="email" placeholder="you@example.com" className="field" />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="label">Topic</span>
            <select className="field w-full cursor-pointer">
              {TOPICS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="label">What happened?</span>
            <textarea
              required
              rows={5}
              placeholder="Describe the issue in as much detail as you can."
              className="field h-auto resize-y py-2 leading-relaxed"
            />
          </label>

          <Button type="submit" fullWidth size="lg" icon={<Send className="h-4 w-4" />}>
            Send message
          </Button>
        </form>
      )}
    </div>
  );
}
