"use client";

import { BATTLE_MODE_LABEL, battleCrates } from "@/components/battle/BattleCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { CaseVisual } from "@/components/visuals/CaseVisual";
import { SkinVisual } from "@/components/visuals/SkinVisual";
import { instantiateSkin } from "@/lib/game";
import { BOT_USERS, CASE_MAP, SKIN_MAP } from "@/lib/mock-data";
import { formatQuotePrice, getSkinPrice } from "@/lib/services/prices/priceProvider";
import { useAppStore } from "@/lib/store";
import type { Battle, BattlePlayer, InventoryItem } from "@/lib/types";
import { weightedSecurePick } from "@/lib/rewards/rng";
import { cn, formatMoney, uid } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Swords } from "lucide-react";
import { useMemo, useState } from "react";

function rollCase(caseId: string): InventoryItem | null {
  const crate = CASE_MAP[caseId];
  if (!crate?.loot.length) return null;
  const hit = weightedSecurePick(crate.loot);
  const skin = SKIN_MAP[hit.skinId];
  if (!skin) return null;
  return instantiateSkin(skin);
}

export function BattleArena({ initial }: { initial: Battle }) {
  const store = useAppStore();
  const [battle, setBattle] = useState(initial);
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Record<string, InventoryItem>>({});
  const crates = useMemo(() => battleCrates(battle.caseIds), [battle.caseIds]);
  const sequence = useMemo(
    () => battle.caseIds.filter((id) => CASE_MAP[id]),
    [battle.caseIds],
  );
  const pot = useMemo(
    () => battle.cost * Math.max(battle.players.length, battle.slots),
    [battle.cost, battle.players.length, battle.slots],
  );

  function fillBots(current: Battle): Battle {
    const next = { ...current, players: [...current.players] };
    while (next.players.length < next.slots) {
      const used = new Set(next.players.map((p) => p.user.id));
      const bot = BOT_USERS.find((u) => !used.has(u.id)) ?? {
        id: uid("bot"),
        username: "Bot" + next.players.length,
        avatarHue: Math.floor(Math.random() * 360),
        level: 20,
      };
      next.players.push({ user: bot, ready: true, winnings: [], total: 0 });
    }
    return next;
  }

  async function join() {
    if (!store.user) {
      store.toast({ title: "Sign in with Steam to join", tone: "warn" });
      return;
    }
    if (battle.players.some((p) => p.user.id === store.user?.id)) {
      start(battle);
      return;
    }
    if (!store.spend(battle.cost)) return;
    const seat: BattlePlayer = {
      user: store.user,
      ready: true,
      winnings: [],
      total: 0,
    };
    const joined = { ...battle, players: [...battle.players, seat] };
    setBattle(joined);
    store.patchBattle(joined);
    store.toast({ title: "Joined battle", tone: "ok" });
    window.setTimeout(() => start(joined), 900);
  }

  async function start(seed: Battle) {
    if (busy) return;
    const ids = seed.caseIds.filter((id) => CASE_MAP[id]);
    if (!ids.length) {
      store.toast({ title: "This battle has no valid cases", tone: "err" });
      return;
    }
    setBusy(true);
    let current = fillBots({ ...seed, status: "live" });
    current.players = current.players.map((p) => ({ ...p, winnings: [], total: 0 }));
    setBattle(current);
    const wait = (ms: number) => new Promise((r) => setTimeout(r, store.reduceMotion ? 180 : ms));

    for (let i = 0; i < ids.length; i++) {
      setRound(i + 1);
      await wait(550);
      const drops: Record<string, InventoryItem> = {};
      current = {
        ...current,
        players: current.players.map((p) => {
          const drop = rollCase(ids[i]!);
          if (!drop) return p;
          drops[p.user.id] = drop;
          const market = getSkinPrice(drop.id, drop.wear).price ?? 0;
          return { ...p, winnings: [...p.winnings, drop], total: +(p.total + market).toFixed(2) };
        }),
      };
      setFlash(drops);
      setBattle({ ...current });
      await wait(1100);
    }

    const winner = current.players.reduce((a, b) => (b.total > a.total ? b : a));
    current = { ...current, status: "finished", winnerId: winner.user.id };
    setBattle(current);
    store.patchBattle(current);
    store.bumpStat("battles");
    store.addHistory({
      kind: "battle",
      title: winner.user.id === store.user?.id ? "Won battle" : "Battle finished",
      detail: `${current.mode} · pots ${formatMoney(winner.total)}`,
      amount: winner.user.id === store.user?.id ? current.cost * (current.slots - 1) : -current.cost,
      result: winner.user.id === store.user?.id ? "win" : "loss",
    });
    const highlight = [...winner.winnings].sort(
      (a, b) => (getSkinPrice(b.id, b.wear).price ?? 0) - (getSkinPrice(a.id, a.wear).price ?? 0),
    )[0];
    if (highlight) {
      store.pushDrop({
        kind: "battle",
        action: "BATTLE_WIN",
        userId: winner.user.id,
        user: winner.user.username,
        avatarHue: winner.user.avatarHue,
        caseId: ids[0] ?? null,
        caseName: ids[0] ? CASE_MAP[ids[0]]?.name ?? "Battle" : "Battle",
        skin: highlight,
        skinId: highlight.id,
        totalValue: winner.total,
      });
    }
    if (winner.user.id === store.user?.id) {
      store.credit(current.cost * current.slots);
      winner.winnings.forEach((s) => store.addItem(s));
      store.toast({ title: "You won the battle", detail: formatMoney(winner.total), tone: "rare" });
    }
    setBusy(false);
    setFlash({});
  }

  const winner = battle.players.find((p) => p.user.id === battle.winnerId);

  return (
    <div className="page-stack">
      <PageHeader
        kicker={BATTLE_MODE_LABEL[battle.mode]}
        title="Case battle"
        description={`Round ${round}/${sequence.length} · Pot ${formatMoney(pot)}`}
        actions={
          <>
            {battle.status === "waiting" && sequence.length > 0 ? (
              <Button size="lg" onClick={join} loading={busy}>
                Join · {formatMoney(battle.cost)}
              </Button>
            ) : null}
            {battle.status === "live" ? <Badge tone="accent">Live</Badge> : null}
            {battle.status === "finished" && winner ? (
              <Badge tone="gold">Winner · {winner.user.username}</Badge>
            ) : null}
          </>
        }
      />

      {sequence.length === 0 ? (
        <EmptyState
          icon={<Swords />}
          title="Cases unavailable"
          detail="None of this lobby’s crate ids are in the catalog, so the round strip is empty."
        />
      ) : (
        <div className="flex gap-3 overflow-x-auto surface-inset p-3">
          {crates.map((crate, i) => (
            <div
              key={`${crate.id}-${i}`}
              className={cn(
                "min-w-24 rounded-[var(--radius-md)] p-2",
                round === i + 1 ? "bg-white/8" : "opacity-55",
              )}
            >
              <CaseVisual crate={crate} size="compact" className="mx-auto h-16 w-16" />
              <p className="meta mt-1 truncate text-center">{crate.name}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: battle.slots }).map((_, i) => {
          const p = battle.players[i];
          const lead = Math.max(0, ...battle.players.map((x) => x.total));
          const isWin = battle.winnerId && p?.user.id === battle.winnerId;
          const latest = p ? flash[p.user.id] : undefined;
          return (
            <div key={i} className={cn("surface surface-pad", isWin && "success-glow")}>
              {p ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <UserAvatar name={p.user.username} hue={p.user.avatarHue} size="sm" level={p.user.level} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{p.user.username}</p>
                      <p className="price text-sm">{formatMoney(p.total)}</p>
                    </div>
                  </div>
                  {p.total === lead && lead > 0 ? <Badge tone="gold">Lead</Badge> : null}
                </div>
              ) : (
                <p className="meta">Waiting for player</p>
              )}
              {latest ? (
                <div className="mt-3 overflow-hidden rounded-[var(--radius-md)] bg-graphite">
                  <SkinVisual skin={latest} framed={false} showWear={false} pad={4} className="h-20 w-full" />
                  <p className="truncate px-2 py-1 text-xs">{latest.name}</p>
                </div>
              ) : null}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <AnimatePresence>
                  {p?.winnings.map((skin) => (
                    <motion.div key={skin.instanceId} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                      <SkinVisual
                        skin={skin}
                        framed={false}
                        showWear={false}
                        pad={2}
                        className="h-16 bg-graphite"
                      />
                      <p className="meta truncate pt-1">
                        {formatQuotePrice(getSkinPrice(skin.id, skin.wear))}
                      </p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
