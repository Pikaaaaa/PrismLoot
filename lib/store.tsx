"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { instantiateSkin, rollWear } from "./game";
import { PRICE_SYNC_INTERVAL_MS } from "./economy/config";
import {
  getSkinPrice,
  hydrateQuotes,
  listingWearFor,
  setDisplayCurrency,
} from "@/lib/services/prices";
import { isValidCurrency } from "@/lib/services/prices/validate";
import {
  liveDropFromLegacy,
  resolveLiveEvent,
  reviveLiveDrops,
  rollDemoLiveEvent,
  seedLiveEvents,
  toLiveEvent,
} from "@/lib/services/liveActivity";
import {
  CASES,
  CASE_MAP,
  CURRENT_USER,
  makeBattles,
  SKIN_MAP,
  SKINS,
  STARTING_INVENTORY_IDS,
} from "./mock-data";
import type {
  Battle,
  BestDrop,
  CurrencyCode,
  HistoryEntry,
  InventoryItem,
  LiveDrop,
  PriceQuote,
  PublicUser,
  Skin,
  ToastItem,
  UserStats,
} from "./types";
import { formatBalance, uid } from "./utils";
import { DISCONNECTED_STEAM, type SteamIdentity } from "@/lib/auth/steam";
import {
  backfillBestDrop,
  hydrateBestDropStats,
  mergeBestDrop,
  parseBestDrop,
  pickHigherBestDrop,
} from "./bestDrop";

const STORAGE_KEY = "prismloot-demo-v2";

type State = {
  hydrated: boolean;
  user: PublicUser | null;
  balance: number;
  inventory: InventoryItem[];
  history: HistoryEntry[];
  liveDrops: LiveDrop[];
  toasts: ToastItem[];
  battles: Battle[];
  stats: UserStats;
  liveFeedOn: boolean;
  reduceMotion: boolean;
  displayCurrency: CurrencyCode;
  savedPromo: string | null;
  tradeUrl: string;
  accountEmail: string;
  steam: SteamIdentity;
  priceTick: number;
  banned: boolean;
  wagerRemainingUsd: number;
};

type Action =
  | { type: "HYDRATE"; payload: Partial<State> }
  | { type: "SET_HYDRATED" }
  | { type: "LOGIN" }
  | { type: "LOGOUT" }
  | { type: "ADD_TOAST"; toast: ToastItem }
  | { type: "DISMISS_TOAST"; id: string }
  | { type: "PUSH_DROP"; drop: LiveDrop }
  | { type: "DEPOSIT"; amount: number }
  | { type: "SPEND"; amount: number }
  | { type: "ADD_ITEM"; item: InventoryItem }
  | { type: "APPLY_OPEN"; amount: number; items: InventoryItem[] }
  | {
      type: "APPLY_UPGRADE";
      extra: number;
      removeIds: string[];
      item: InventoryItem | null;
    }
  | { type: "REMOVE_ITEMS"; ids: string[] }
  | { type: "MARK_WITHDRAW_PENDING"; instanceId: string }
  | { type: "ADD_HISTORY"; entry: HistoryEntry }
  | { type: "SET_BATTLES"; battles: Battle[] }
  | { type: "PATCH_BATTLE"; battle: Battle }
  | { type: "SET_STATS"; stats: Partial<UserStats> }
  | { type: "MERGE_BEST_DROP"; drop: BestDrop | null }
  | { type: "SET_SETTING"; key: "liveFeedOn" | "reduceMotion"; value: boolean }
  | { type: "SET_CURRENCY"; value: CurrencyCode }
  | { type: "SAVE_PROMO"; code: string }
  | { type: "SET_TRADE_URL"; value: string }
  | { type: "SET_EMAIL"; value: string }
  | { type: "PRICE_TICK" }
  | {
      type: "APPLY_SERVER";
      balance: number;
      inventory: InventoryItem[];
      bestDrop: BestDrop | null;
      banned: boolean;
      wagerRemainingUsd?: number;
      tradeUrl?: string;
      stats?: Partial<UserStats>;
    }
  | { type: "SET_WAGER"; remaining: number }
  | { type: "APPLY_WAGER_VOLUME"; volume: number };

const SEED_TIME = 1_740_000_000_000;

const starterInventory: InventoryItem[] = STARTING_INVENTORY_IDS.flatMap((row, index) => {
  const skin = SKIN_MAP[row.skinId];
  if (!skin) return [];
  return [
    instantiateSkin(skin, {
      wear: row.wear,
      stattrak: row.stattrak,
      instanceId: `seed_${index}`,
      obtainedAt: SEED_TIME - index * 86_000_000,
    }),
  ];
});

const LIVE_FEED_CAP = 40;

function isInventoryItem(skin?: Skin): skin is InventoryItem {
  return !!skin && "instanceId" in skin;
}

function attachDropWear(drop: LiveDrop, instance?: Skin): LiveDrop {
  const catalog = SKIN_MAP[drop.skinId] ?? drop.skin;
  const listing = listingWearFor(drop.skinId) ?? catalog.wear;
  const wear = isInventoryItem(instance) ? instance.wear : listing;
  return {
    ...drop,
    skin: instantiateSkin(catalog, {
      wear,
      stattrak: isInventoryItem(instance) ? instance.stattrak : false,
      instanceId: isInventoryItem(instance) ? instance.instanceId : drop.id,
      obtainedAt: isInventoryItem(instance) ? instance.obtainedAt : drop.at,
    }),
  };
}

const initialDrops: LiveDrop[] = seedLiveEvents().map((drop) => attachDropWear(drop));

const seedHistory: HistoryEntry[] = [
  {
    id: "h1",
    kind: "open",
    title: "Opened Prism Core",
    detail: "AK-47 | Neon Rider",
    amount: -2.49,
    at: SEED_TIME - 3600_000,
  },
  {
    id: "h2",
    kind: "upgrade",
    title: "Upgrade success",
    detail: "USP-S | Printstream",
    amount: 54.8,
    at: SEED_TIME - 7200_000,
  },
  {
    id: "h3",
    kind: "battle",
    title: "Won 1v1 battle",
    detail: "vs ShadowWolf",
    amount: 9.98,
    at: SEED_TIME - 10800_000,
  },
  {
    id: "h4",
    kind: "sell",
    title: "Sold item",
    detail: "Glock-18 | Sand Dune",
    amount: 0.14,
    at: SEED_TIME - 14400_000,
  },
];

const initial: State = {
  hydrated: false,
  user: CURRENT_USER,
  balance: 12500,
  inventory: starterInventory,
  history: seedHistory,
  liveDrops: initialDrops,
  toasts: [],
  battles: makeBattles(),
  stats: (() => {
    const bestDrop = backfillBestDrop(null, starterInventory, seedHistory);
    return {
      openedCases: 1284,
      battles: 96,
      upgrades: 211,
      contracts: 64,
      bestDrop,
      bestDropBackfilled: true,
      biggestWin: bestDrop
        ? { name: bestDrop.snapshot.name, price: bestDrop.valueUsd }
        : { name: "", price: 0 },
    };
  })(),
  liveFeedOn: true,
  reduceMotion: false,
  displayCurrency: "USD",
  savedPromo: null,
  tradeUrl: "",
  accountEmail: "",
  steam: DISCONNECTED_STEAM,
  priceTick: 0,
  banned: false,
  wagerRemainingUsd: 0,
};

function persistable(state: State) {
  return {
    user: state.user,
    balance: state.balance,
    inventory: state.inventory,
    history: state.history,
    stats: state.stats,
    liveFeedOn: state.liveFeedOn,
    reduceMotion: state.reduceMotion,
    displayCurrency: state.displayCurrency,
    savedPromo: state.savedPromo,
    tradeUrl: state.tradeUrl,
    accountEmail: state.accountEmail,
    wagerRemainingUsd: state.wagerRemainingUsd,
    liveEvents: state.liveDrops.map(toLiveEvent),
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "HYDRATE":
      return { ...state, ...action.payload, hydrated: true };
    case "SET_HYDRATED":
      return { ...state, hydrated: true };
    case "LOGIN":
      return { ...state, user: CURRENT_USER };
    case "LOGOUT":
      return { ...state, user: null };
    case "ADD_TOAST": {
      const dup = state.toasts.find(
        (t) => t.title === action.toast.title && (t.detail ?? "") === (action.toast.detail ?? ""),
      );
      if (dup) return state;
      return { ...state, toasts: [...state.toasts.slice(-2), action.toast] };
    }
    case "DISMISS_TOAST":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    case "PUSH_DROP": {
      if (state.liveDrops[0]?.id === action.drop.id) return state;
      return { ...state, liveDrops: [action.drop, ...state.liveDrops].slice(0, LIVE_FEED_CAP) };
    }
    case "DEPOSIT":
      return { ...state, balance: +(state.balance + action.amount).toFixed(2) };
    case "SPEND":
      return { ...state, balance: +(state.balance - action.amount).toFixed(2) };
    case "ADD_ITEM":
      if (state.inventory.some((item) => item.instanceId === action.item.instanceId)) {
        return state;
      }
      return {
        ...state,
        inventory: [action.item, ...state.inventory],
        stats: mergeBestDrop(state.stats, [action.item]),
      };
    case "APPLY_OPEN": {
      const have = new Set(state.inventory.map((i) => i.instanceId));
      const fresh = action.items.filter((item) => !have.has(item.instanceId));
      return {
        ...state,
        balance: +(state.balance - action.amount).toFixed(2),
        wagerRemainingUsd: Math.max(0, +(state.wagerRemainingUsd - action.amount).toFixed(2)),
        inventory: [...fresh, ...state.inventory],
        stats: mergeBestDrop(
          { ...state.stats, openedCases: state.stats.openedCases + action.items.length },
          action.items,
        ),
      };
    }
    case "APPLY_UPGRADE": {
      const extra = action.extra > 0 ? action.extra : 0;
      const stripped = state.inventory.filter((i) => !action.removeIds.includes(i.instanceId));
      const have = new Set(stripped.map((i) => i.instanceId));
      const next =
        action.item && !have.has(action.item.instanceId) ? [action.item, ...stripped] : stripped;
      const staked = state.inventory
        .filter((item) => action.removeIds.includes(item.instanceId))
        .reduce((sum, item) => {
          const quote = getSkinPrice(item.id, item.wear);
          return sum + (quote.available && quote.price != null ? quote.price : item.price);
        }, 0);
      return {
        ...state,
        balance: +(state.balance - extra).toFixed(2),
        wagerRemainingUsd: Math.max(0, +(state.wagerRemainingUsd - extra - staked).toFixed(2)),
        inventory: next,
        stats: action.item ? mergeBestDrop(state.stats, [action.item]) : state.stats,
      };
    }
    case "REMOVE_ITEMS":
      return {
        ...state,
        inventory: state.inventory.filter((i) => !action.ids.includes(i.instanceId)),
      };
    case "MARK_WITHDRAW_PENDING":
      return {
        ...state,
        inventory: state.inventory.map((item) =>
          item.instanceId === action.instanceId ? { ...item, withdrawPending: true } : item,
        ),
      };
    case "ADD_HISTORY":
      return { ...state, history: [action.entry, ...state.history].slice(0, 80) };
    case "SET_BATTLES":
      return { ...state, battles: action.battles };
    case "PATCH_BATTLE":
      return {
        ...state,
        battles: state.battles.map((b) => (b.id === action.battle.id ? action.battle : b)),
      };
    case "SET_STATS":
      return { ...state, stats: { ...state.stats, ...action.stats } };
    case "MERGE_BEST_DROP": {
      const best = pickHigherBestDrop(state.stats.bestDrop, action.drop);
      if (best === state.stats.bestDrop) return state;
      return {
        ...state,
        stats: {
          ...state.stats,
          bestDrop: best,
          biggestWin: best ? { name: best.snapshot.name, price: best.valueUsd } : state.stats.biggestWin,
        },
      };
    }
    case "SET_SETTING":
      return { ...state, [action.key]: action.value };
    case "SET_CURRENCY":
      return { ...state, displayCurrency: action.value };
    case "SAVE_PROMO":
      return { ...state, savedPromo: action.code };
    case "SET_TRADE_URL":
      return { ...state, tradeUrl: action.value };
    case "SET_EMAIL":
      return { ...state, accountEmail: action.value };
    case "PRICE_TICK":
      return { ...state, priceTick: state.priceTick + 1 };
    case "SET_WAGER":
      return { ...state, wagerRemainingUsd: Math.max(0, +action.remaining.toFixed(2)) };
    case "APPLY_WAGER_VOLUME":
      return {
        ...state,
        wagerRemainingUsd: Math.max(0, +(state.wagerRemainingUsd - Math.max(0, action.volume)).toFixed(2)),
      };
    case "APPLY_SERVER": {
      const best = action.bestDrop;
      return {
        ...state,
        balance: action.balance,
        inventory: action.inventory,
        banned: action.banned,
        wagerRemainingUsd:
          typeof action.wagerRemainingUsd === "number" ? Math.max(0, action.wagerRemainingUsd) : state.wagerRemainingUsd,
        tradeUrl:
          typeof action.tradeUrl === "string" && action.tradeUrl.trim() ? action.tradeUrl.trim() : state.tradeUrl,
        stats: {
          ...state.stats,
          ...action.stats,
          bestDrop: best,
          biggestWin: best
            ? { name: best.snapshot.name, price: best.valueUsd }
            : { name: "", price: 0 },
        },
      };
    }
    default:
      return state;
  }
}

type Store = State & {
  inventoryValue: number;
  toast: (t: Omit<ToastItem, "id">) => void;
  login: () => void;
  logout: () => void;
  deposit: (amount: number) => void;
  credit: (amount: number) => void;
  spend: (amount: number) => boolean;
  addItem: (item: InventoryItem) => void;
  applyOpen: (amount: number, items: InventoryItem[]) => boolean;
  applyUpgrade: (input: { extra: number; removeIds: string[]; item: InventoryItem | null }) => boolean;
  removeItems: (ids: string[], sales?: Record<string, number>) => void;
  markWithdrawPending: (instanceId: string) => void;
  addHistory: (entry: Omit<HistoryEntry, "id" | "at">) => void;
  pushDrop: (drop: Partial<LiveDrop> & { skin?: Skin; caseName?: string }) => void;
  patchBattle: (battle: Battle) => void;
  bumpStat: (key: "openedCases" | "battles" | "upgrades" | "contracts" | "biggestWin", extra?: Partial<UserStats>) => void;
  setSetting: (key: "liveFeedOn" | "reduceMotion", value: boolean) => void;
  setCurrency: (code: CurrencyCode) => void;
  savePromo: (code: string) => void;
  setTradeUrl: (url: string) => void;
  setAccountEmail: (email: string) => void;
  setWagerRemaining: (remaining: number) => void;
  applyWagerVolume: (volumeUsd: number) => void;
  beginSteamLogin: () => void;
  bumpPrices: () => void;
  catalog: typeof SKINS;
};

type FeedCadence = "short" | "pause" | "burst" | "quiet";

function randInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickFeedCadence(prev: FeedCadence): FeedCadence {
  if (prev === "burst") return "quiet";
  if (prev === "quiet") return Math.random() < 0.55 ? "short" : "pause";
  const roll = Math.random();
  if (prev === "short") {
    if (roll < 0.45) return "pause";
    if (roll < 0.7) return "burst";
    if (roll < 0.88) return "short";
    return "quiet";
  }
  if (roll < 0.28) return "short";
  if (roll < 0.5) return "burst";
  if (roll < 0.74) return "pause";
  return "quiet";
}

function feedDelayMs(cadence: FeedCadence): number {
  switch (cadence) {
    case "short":
      return randInt(1500, 3000);
    case "pause":
      return randInt(5000, 9000);
    case "burst":
      return randInt(1400, 2600);
    case "quiet":
      return randInt(8000, 14000);
  }
}

function rollBotLiveDrop(): LiveDrop | null {
  for (let i = 0; i < 8; i++) {
    const drop = resolveLiveEvent(rollDemoLiveEvent());
    if (drop) return attachDropWear(drop);
  }
  const seed = initialDrops[0];
  if (!seed) return null;
  return attachDropWear({ ...seed, id: uid("ld"), at: Date.now() });
}

const Ctx = createContext<Store | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);

  useLayoutEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<State> & { liveEvents?: unknown };
        const revived = reviveLiveDrops(parsed.liveEvents).map((drop) => attachDropWear(drop));
        const inventory = parsed.inventory?.length
          ? parsed.inventory.map((item, _index, list) => {
              const cat = SKIN_MAP[item.id];
              const stuckFn = list.length > 1 && list.every((row) => row.wear === "fn");
              const wear = stuckFn || !item.wear ? rollWear(item.rarity) : item.wear;
              return cat
                ? {
                    ...item,
                    wear,
                    rarity: cat.rarity,
                    image: cat.image,
                    collection: cat.collection,
                    colors: cat.colors,
                  }
                : { ...item, wear };
            })
          : initial.inventory;
        const history = parsed.history ?? initial.history;
        dispatch({
          type: "HYDRATE",
          payload: {
            user: parsed.user === null ? null : parsed.user || CURRENT_USER,
            balance: parsed.balance ?? initial.balance,
            inventory,
            history,
            stats: hydrateBestDropStats(parsed.stats, inventory, history, initial.stats),
            liveFeedOn: parsed.liveFeedOn ?? true,
            reduceMotion: parsed.reduceMotion ?? false,
            displayCurrency: isValidCurrency(parsed.displayCurrency) ? parsed.displayCurrency : "USD",
            savedPromo: typeof parsed.savedPromo === "string" ? parsed.savedPromo : null,
            tradeUrl: typeof parsed.tradeUrl === "string" ? parsed.tradeUrl : "",
            accountEmail: typeof parsed.accountEmail === "string" ? parsed.accountEmail : "",
            wagerRemainingUsd:
              typeof parsed.wagerRemainingUsd === "number" ? Math.max(0, parsed.wagerRemainingUsd) : 0,
            liveDrops: revived.length ? revived : initial.liveDrops,
          },
        });
        return;
      }
    } catch {
      /* ignore */
    }
    dispatch({ type: "SET_HYDRATED" });
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable(state)));
  }, [state]);

  useEffect(() => {
    if (state.displayCurrency) setDisplayCurrency(state.displayCurrency);
  }, [state.displayCurrency]);

  useEffect(() => {
    if (!state.hydrated || !state.user) return;
    let cancelled = false;
    async function pullMe() {
      try {
        const res = await fetch("/api/me");
        const data = (await res.json()) as {
          ok?: boolean;
          balance?: number;
          inventory?: InventoryItem[];
          bestDrop?: unknown;
          banned?: boolean;
          wagerRemainingUsd?: number;
          tradeUrl?: string;
          stats?: { openedCases?: number; upgrades?: number; contracts?: number };
        };
        if (cancelled || !data.ok || !Array.isArray(data.inventory) || typeof data.balance !== "number") {
          return;
        }
        dispatch({
          type: "APPLY_SERVER",
          balance: data.balance,
          inventory: data.inventory,
          bestDrop: parseBestDrop(data.bestDrop),
          banned: Boolean(data.banned),
          wagerRemainingUsd: typeof data.wagerRemainingUsd === "number" ? data.wagerRemainingUsd : undefined,
          tradeUrl: typeof data.tradeUrl === "string" ? data.tradeUrl : undefined,
          stats: data.stats,
        });
      } catch {
        /* keep local until next pull */
      }
    }
    void pullMe();
    const onFocus = () => void pullMe();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, [state.hydrated, state.user]);

  useEffect(() => {
    let cancelled = false;
    async function pull() {
      try {
        const res = await fetch("/api/prices");
        const data = (await res.json()) as { ok?: boolean; quotes?: PriceQuote[] };
        if (cancelled || !data.ok || !data.quotes) return;
        hydrateQuotes(data.quotes);
        dispatch({ type: "PRICE_TICK" });
      } catch {
        /* keep snapshot */
      }
    }
    void pull();
    const id = window.setInterval(() => void pull(), PRICE_SYNC_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const toast = useCallback((t: Omit<ToastItem, "id">) => {
    const id = uid("toast");
    dispatch({ type: "ADD_TOAST", toast: { ...t, id } });
    setTimeout(() => dispatch({ type: "DISMISS_TOAST", id }), t.href ? 10000 : 3400);
  }, []);

  useEffect(() => {
    if (!state.hydrated || !state.liveFeedOn) return;
    let cancelled = false;
    let timer = 0;
    let prev: FeedCadence = "quiet";

    const emit = () => {
      const drop = rollBotLiveDrop();
      if (drop) dispatch({ type: "PUSH_DROP", drop });
    };

    const schedule = () => {
      if (cancelled) return;
      const cadence = pickFeedCadence(prev);
      prev = cadence;
      const wait = feedDelayMs(cadence);

      timer = window.setTimeout(() => {
        if (cancelled) return;
        emit();
        if (cadence !== "burst") {
          schedule();
          return;
        }
        timer = window.setTimeout(() => {
          if (cancelled) return;
          emit();
          schedule();
        }, randInt(700, 1400));
      }, wait);
    };

    timer = window.setTimeout(schedule, randInt(1200, 2200));
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [state.hydrated, state.liveFeedOn]);

  const inventoryValue = useMemo(
    () =>
      state.inventory.reduce((sum, item) => {
        if (item.withdrawPending) return sum;
        const quote = getSkinPrice(item.id, item.wear);
        return quote.available && quote.price != null ? sum + quote.price : sum;
      }, 0),
    [state.inventory, state.priceTick],
  );

  const spend = useCallback(
    (amount: number) => {
      if (!state.user) {
        toast({ title: "Sign in required", detail: "Sign in to continue.", tone: "warn" });
        return false;
      }
      if (state.balance < amount) {
        toast({ title: "Not enough balance", detail: "Add funds from Deposit first.", tone: "err" });
        return false;
      }
      dispatch({ type: "SPEND", amount });
      return true;
    },
    [state.balance, state.user, toast],
  );

  const value = useMemo<Store>(
    () => ({
      ...state,
      inventoryValue,
      catalog: SKINS,
      toast,
      login: () => {
        dispatch({ type: "LOGIN" });
        toast({ title: "Signed in", detail: "Welcome back, NovaPrime.", tone: "ok" });
      },
      logout: () => {
        dispatch({ type: "LOGOUT" });
        toast({ title: "Signed out", tone: "warn" });
      },
      credit: (amount) => dispatch({ type: "DEPOSIT", amount }),
      setWagerRemaining: (remaining) => dispatch({ type: "SET_WAGER", remaining }),
      applyWagerVolume: (volumeUsd) => dispatch({ type: "APPLY_WAGER_VOLUME", volume: volumeUsd }),
      deposit: (amount) => {
        dispatch({ type: "DEPOSIT", amount });
        dispatch({
          type: "ADD_HISTORY",
          entry: {
            id: uid("h"),
            kind: "deposit",
            title: "Deposit",
            detail: "Play credits added",
            amount,
            at: Date.now(),
          },
        });
        toast({ title: "Balance updated", detail: `+${formatBalance(amount)} credited`, tone: "ok" });
      },
      spend,
      addItem: (item) => dispatch({ type: "ADD_ITEM", item }),
      applyOpen: (amount, items) => {
        if (!state.user) {
          toast({ title: "Sign in required", tone: "warn" });
          return false;
        }
        if (state.balance < amount) {
          toast({ title: "Not enough balance", detail: "Add funds from Deposit first.", tone: "err" });
          return false;
        }
        dispatch({ type: "APPLY_OPEN", amount, items });
        return true;
      },
      applyUpgrade: ({ extra, removeIds, item }) => {
        if (!state.user) {
          toast({ title: "Sign in required", tone: "warn" });
          return false;
        }
        if (extra > 0 && state.balance < extra) {
          toast({ title: "Not enough balance", tone: "err" });
          return false;
        }
        dispatch({ type: "APPLY_UPGRADE", extra, removeIds, item });
        return true;
      },
      removeItems: (ids, sales) => {
        dispatch({ type: "REMOVE_ITEMS", ids });
        void fetch("/api/persist/inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, sales }),
        }).catch(() => undefined);
      },
      markWithdrawPending: (instanceId) => dispatch({ type: "MARK_WITHDRAW_PENDING", instanceId }),
      addHistory: (entry) =>
        dispatch({
          type: "ADD_HISTORY",
          entry: { ...entry, id: uid("h"), at: Date.now() },
        }),
      pushDrop: (drop) => {
        const resolved = liveDropFromLegacy(drop);
        if (!resolved) return;
        dispatch({
          type: "PUSH_DROP",
          drop: attachDropWear({ ...resolved, id: uid("ld"), at: Date.now() }, drop.skin),
        });
      },
      patchBattle: (battle) => dispatch({ type: "PATCH_BATTLE", battle }),
      bumpStat: (key, extra) => {
        if (key === "biggestWin") {
          dispatch({ type: "SET_STATS", stats: extra ?? {} });
          return;
        }
        dispatch({
          type: "SET_STATS",
          stats: {
            [key]: (state.stats[key] as number) + 1,
            ...extra,
          },
        });
      },
      setSetting: (key, value) => dispatch({ type: "SET_SETTING", key, value }),
      setCurrency: (code) => {
        setDisplayCurrency(code);
        dispatch({ type: "SET_CURRENCY", value: code });
        dispatch({ type: "PRICE_TICK" });
      },
      savePromo: (code) => {
        dispatch({ type: "SAVE_PROMO", code });
        void fetch("/api/persist/promo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        }).catch(() => undefined);
        toast({
          title: "Promo saved — deposits coming soon",
          detail: `${code} · demo only, no top-up`,
          tone: "ok",
        });
      },
      setTradeUrl: (url) => {
        dispatch({ type: "SET_TRADE_URL", value: url });
        void fetch("/api/persist/trade-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        }).catch(() => undefined);
      },
      setAccountEmail: (email) => dispatch({ type: "SET_EMAIL", value: email }),
      beginSteamLogin: () => {
        void fetch("/api/auth/steam").catch(() => undefined);
        toast({
          title: "Steam login coming soon",
          detail: "Identity only — we never ask for a Steam password.",
          tone: "warn",
        });
      },
      bumpPrices: () => dispatch({ type: "PRICE_TICK" }),
    }),
    [inventoryValue, spend, state, toast],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppStore must be used within AppStoreProvider");
  return ctx;
}

export { CASE_MAP, CASES, SKIN_MAP, SKINS };
