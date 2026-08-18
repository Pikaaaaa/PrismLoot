"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { CaseVisual } from "@/components/visuals/CaseVisual";
import { CASE_MAP } from "@/lib/mock-data";
import type { Battle, BattleMode, BattleStatus, Crate } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import Link from "next/link";

export const BATTLE_MODE_LABEL: Record<BattleMode | "all", string> = {
  all: "All",
  "1v1": "1v1",
  "2v2": "2v2",
  "3v3": "3v3",
  ffa: "FFA",
};

const STATUS_TONE: Record<BattleStatus, "neutral" | "accent" | "outline"> = {
  waiting: "neutral",
  live: "accent",
  finished: "outline",
};

const STATUS_LABEL: Record<BattleStatus, string> = {
  waiting: "Waiting",
  live: "Live",
  finished: "Finished",
};

/** Known crates only — missing CASE_MAP ids never become empty 56px columns. */
export function battleCrates(ids: string[]): Crate[] {
  const crates: Crate[] = [];
  for (const id of ids) {
    const crate = CASE_MAP[id];
    if (crate) crates.push(crate);
  }
  return crates;
}

export function BattleCard({ battle }: { battle: Battle }) {
  const filled = battle.players.length;
  const crates = battleCrates(battle.caseIds);
  const cta =
    battle.status === "waiting" ? "Join" : battle.status === "live" ? "Watch" : "Replay";

  return (
    <article className="group surface card-hover relative flex min-w-0 flex-col overflow-hidden">
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <Badge tone={STATUS_TONE[battle.status]}>{STATUS_LABEL[battle.status]}</Badge>
          <span className="label">{BATTLE_MODE_LABEL[battle.mode]}</span>
        </div>

        <div className="flex -space-x-2">
          {Array.from({ length: battle.slots }).map((_, i) => {
            const player = battle.players[i];
            return player ? (
              <UserAvatar
                key={player.user.id}
                name={player.user.username}
                hue={player.user.avatarHue}
                size="sm"
              />
            ) : (
              <div
                key={`open-${i}`}
                className="h-8 w-8 rounded-[var(--radius-md)] border border-dashed border-line bg-graphite"
              />
            );
          })}
        </div>

        <p className="meta">
          {filled}/{battle.slots} players
        </p>

        {crates.length ? (
          <div className="flex gap-2 overflow-x-auto">
            {crates.map((crate, i) => (
              <CaseVisual
                key={`${crate.id}-${i}`}
                crate={crate}
                size="compact"
                className="h-14 w-14 shrink-0"
              />
            ))}
          </div>
        ) : (
          <p className="meta">Cases unavailable</p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <p className="price">{formatMoney(battle.cost)}</p>
          <Button
            size="sm"
            variant={battle.status === "waiting" ? "primary" : "ghost"}
            aria-hidden
            tabIndex={-1}
            className="pointer-events-none"
          >
            {cta}
          </Button>
        </div>
      </div>

      <Link
        href={`/battles/${battle.id}`}
        aria-label={`${cta} ${BATTLE_MODE_LABEL[battle.mode]} battle`}
        className="absolute inset-0 z-[2] rounded-[var(--radius-lg)]"
      />
    </article>
  );
}
