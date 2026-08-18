"use client";

import { BattleArena } from "@/components/battle/BattleArena";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAppStore } from "@/lib/store";
import { Swords } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function BattlePage() {
  const { id } = useParams<{ id: string }>();
  const { battles } = useAppStore();
  const battle = battles.find((row) => row.id === id);

  if (!battle) {
    return (
      <div className="page-stack">
        <PageHeader
          kicker="Arena"
          title="Battle expired"
          description="This lobby is no longer in the list."
        />
        <EmptyState
          icon={<Swords />}
          title="Lobby not found"
          detail="The battle list was refreshed, or that id never existed."
          action={
            <Link href="/battles">
              <Button>Back to arena</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return <BattleArena initial={battle} />;
}
