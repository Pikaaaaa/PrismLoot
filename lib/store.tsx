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
import { getCatalogItem } from "@/lib/itemCatalog";
import { instantiateSkin } from "./game";
import { PRICE_SYNC_INTERVAL_MS } from "./economy/config";
import {
  getSkinPrice,
  hydrateQuotes,
  listingWearFor,
  setDisplayCurrency,
} from "@/lib/services/prices";
import { marketValueUsd } from "@/lib/economy";
import { isValidCurrency } from "@/lib/services/prices/validate";
import {
  liveDropFromLegacy,
  resolveLiveEvent,
  rollDemoLiveEvent,
  seedLiveEvents,
} from "@/lib/services/liveActivity";
import {
  CASES,
  CASE_MAP,
  makeBattles,
  SKIN_MAP,
  SKINS,
} from "./mock-data";
import type {
  Battle,
  BestDrop,
  CurrencyCode,
  HistoryEntry,
  InventoryItem,
  InventoryLeftVia,
  LiveDrop,
  PriceQuote,
  PublicUser,
  Skin,
  ToastItem,
  UserStats,
} from "./types";
import { formatBalance, uid } from "./utils";
import { DISCONNECTED_STEAM, type SteamIdentity } from "@/lib/auth/steam";
import { parseHistoryEntries } from "@/components/profile/activity";
import {
  mergeBestDrop,
  parseBestDrop,
  pickHigherBestDrop,
} from "./bestDrop";
import type { FreeCaseClaimSummary } from "@/lib/case-coupons/types";
import { isInVault } from "@/lib/inventoryOwnership";

const PREFS_KEY = "prismloot-prefs-v3";
const LEGACY_DEMO_KEYS = ["prismloot-demo-v2", "prismloot-demo-v1", "prismloot-demo"];

type State = {
  hydrated: boolean;
  /** True after the first `/api/me` response (session or guest). */
  sessionReady: boolean;
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
  savedCasePromo: string | null;
  tradeUrl: string;
  accountEmail: string;
  steam: SteamIdentity;
  priceTick: number;
  banned: boolean;
  wagerRemainingUsd: number;
  joinedAt: number | null;
  freeCaseClaims: FreeCaseClaimSummary[];
};

type Action =
  | { type: "HYDRATE"; payload: Partial<State> }
  | { type: "SET_HYDRATED" }
  | { type: "SESSION_READY" }
  | { type: "SET_SESSION"; user: PublicUser; steam: SteamIdentity }
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
  | { type: "MARK_LEFT"; ids: string[]; leftVia: InventoryLeftVia }
  | { type: "MARK_WITHDRAW_PENDING"; instanceId: string }
  | { type: "ADD_HISTORY"; entry: HistoryEntry }
  | { type: "SET_BATTLES"; battles: Battle[] }
  | { type: "PATCH_BATTLE"; battle: Battle }
  | { type: "SET_STATS"; stats: Partial<UserStats> }
  | { type: "MERGE_BEST_DROP"; drop: BestDrop | null }
  | { type: "SET_SETTING"; key: "liveFeedOn" | "reduceMotion"; value: boolean }
  | { type: "SET_CURRENCY"; value: CurrencyCode }
  | { type: "SAVE_PROMO"; code: string }
  | { type: "SAVE_CASE_PROMO"; code: string }
  | { type: "ADD_FREE_CLAIM"; claim: FreeCaseClaimSummary }
  | { type: "CONSUME_FREE_CLAIMS"; caseId: string; count: number }
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
      accountEmail?: string;
      joinedAt?: number | null;
      history?: HistoryEntry[];
      stats?: Partial<UserStats>;
      freeCaseClaims?: FreeCaseClaimSummary[];
    }
  | { type: "SET_WAGER"; remaining: number }
  | { type: "APPLY_WAGER_VOLUME"; volume: number };

const LIVE_FEED_CAP = 40;

function isInventoryItem(skin?: Skin): skin is InventoryItem {
  return !!skin && "instanceId" in skin;
}

function attachDropWear(drop: LiveDrop, instance?: Skin): LiveDrop {
  const catalog = getCatalogItem(drop.skinId) ?? drop.skin;
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

const emptyStats: UserStats = {
  openedCases: 0,
  battles: 0,
  upgrades: 0,
  contracts: 0,
  wageredUsd: 0,
  upgradesWon: 0,
  upgradesLost: 0,
  bestDrop: null,
  bestDropBackfilled: true,
  biggestWin: { name: "", price: 0 },
};

const initial: State = {
  hydrated: false,
  sessionReady: false,
  user: null,
  balance: 0,
  inventory: [],
  history: [],
  liveDrops: initialDrops,
  toasts: [],
  battles: makeBattles(),
  stats: emptyStats,
  liveFeedOn: true,
  reduceMotion: false,
  displayCurrency: "USD",
  savedPromo: null,
  savedCasePromo: null,
  tradeUrl: "",
  accountEmail: "",
  steam: DISCONNECTED_STEAM,
  priceTick: 0,
  banned: false,
  wagerRemainingUsd: 0,
  joinedAt: null,
  freeCaseClaims: [],
};

function persistable(state: State) {
  return {
    liveFeedOn: state.liveFeedOn,
    reduceMotion: state.reduceMotion,
    displayCurrency: state.displayCurrency,
    savedPromo: state.savedPromo,
    savedCasePromo: state.savedCasePromo,
  };
}

function mergeSessionHistory(local: HistoryEntry[], server?: HistoryEntry[]) {
  if (!server) return local;
  const seen = new Set(server.map((entry) => `${entry.kind}|${entry.title}|${entry.at}`));
  const extra = local.filter(
    (entry) => entry.id.startsWith("h_") && !seen.has(`${entry.kind}|${entry.title}|${entry.at}`),
  );
  return [...extra, ...server].slice(0, 80);
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "HYDRATE":
      return {
        ...state,
        liveFeedOn: action.payload.liveFeedOn ?? state.liveFeedOn,
        reduceMotion: action.payload.reduceMotion ?? state.reduceMotion,
        displayCurrency: action.payload.displayCurrency ?? state.displayCurrency,
        savedPromo: action.payload.savedPromo ?? state.savedPromo,
        savedCasePromo: action.payload.savedCasePromo ?? state.savedCasePromo,
        user: null,
        steam: DISCONNECTED_STEAM,
        balance: 0,
        inventory: [],
        history: [],
        stats: emptyStats,
        banned: false,
        wagerRemainingUsd: 0,
        tradeUrl: "",
        joinedAt: null,
        freeCaseClaims: [],
        hydrated: true,
      };
    case "SET_HYDRATED":
      return { ...state, hydrated: true };
    case "SESSION_READY":
      return { ...state, sessionReady: true };
    case "SET_SESSION":
      return { ...state, user: action.user, steam: action.steam, sessionReady: true };
    case "LOGOUT":
      return {
        ...state,
        user: null,
        steam: DISCONNECTED_STEAM,
        sessionReady: true,
        balance: 0,
        inventory: [],
        history: [],
        stats: emptyStats,
        banned: false,
        wagerRemainingUsd: 0,
        tradeUrl: "",
        joinedAt: null,
        freeCaseClaims: [],
      };
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
          {
            ...state.stats,
            openedCases: state.stats.openedCases + action.items.length,
            wageredUsd: +(state.stats.wageredUsd + action.amount).toFixed(2),
          },
          action.items,
        ),
      };
    }
    case "APPLY_UPGRADE": {
      const extra = action.extra > 0 ? action.extra : 0;
      const marked = state.inventory.map((item) =>
        action.removeIds.includes(item.instanceId)
          ? { ...item, leftVia: "upgrade" as const, soldAt: item.soldAt ?? Date.now() }
          : item,
      );
      const have = new Set(marked.map((i) => i.instanceId));
      const next =
        action.item && !have.has(action.item.instanceId) ? [action.item, ...marked] : marked;
      const staked = state.inventory
        .filter((item) => action.removeIds.includes(item.instanceId))
        .reduce((sum, item) => {
          const market = marketValueUsd(item.id, item.wear, item.stickers, item.price);
          return sum + (market ?? 0);
        }, 0);
      return {
        ...state,
        balance: +(state.balance - extra).toFixed(2),
        wagerRemainingUsd: Math.max(0, +(state.wagerRemainingUsd - extra - staked).toFixed(2)),
        inventory: next,
        stats: action.item
          ? mergeBestDrop(
              {
                ...state.stats,
                wageredUsd: +(state.stats.wageredUsd + extra).toFixed(2),
                upgradesWon: state.stats.upgradesWon + 1,
              },
              [action.item],
            )
          : {
              ...state.stats,
              wageredUsd: +(state.stats.wageredUsd + extra).toFixed(2),
              upgradesLost: state.stats.upgradesLost + 1,
            },
      };
    }
    case "REMOVE_ITEMS":
      return {
        ...state,
        inventory: state.inventory.filter((i) => !action.ids.includes(i.instanceId)),
      };
    case "MARK_LEFT":
      return {
        ...state,
        inventory: state.inventory.map((item) =>
          action.ids.includes(item.instanceId)
            ? { ...item, leftVia: action.leftVia, soldAt: item.soldAt ?? Date.now() }
            : item,
        ),
      };
    case "MARK_WITHDRAW_PENDING":
      return {
        ...state,
        inventory: state.inventory.map((item) =>
          item.instanceId === action.instanceId
            ? {
                ...item,
                withdrawPending: true,
                leftVia: "withdraw",
                soldAt: item.soldAt ?? Date.now(),
              }
            : item,
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
    case "SAVE_CASE_PROMO":
      return { ...state, savedCasePromo: action.code };
    case "ADD_FREE_CLAIM": {
      const existing = state.freeCaseClaims.find((row) => row.caseId === action.claim.caseId);
      if (existing) {
        return {
          ...state,
          freeCaseClaims: state.freeCaseClaims.map((row) =>
            row.caseId === action.claim.caseId
              ? { ...row, remaining: row.remaining + action.claim.remaining, caseName: action.claim.caseName }
              : row,
          ),
        };
      }
      return { ...state, freeCaseClaims: [...state.freeCaseClaims, action.claim] };
    }
    case "CONSUME_FREE_CLAIMS": {
      let left = Math.max(0, action.count);
      if (left <= 0) return state;
      return {
        ...state,
        freeCaseClaims: state.freeCaseClaims
          .map((row) => {
            if (row.caseId !== action.caseId || left <= 0) return row;
            const take = Math.min(left, row.remaining);
            left -= take;
            return { ...row, remaining: row.remaining - take };
          })
          .filter((row) => row.remaining > 0),
      };
    }
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
        accountEmail:
          typeof action.accountEmail === "string" ? action.accountEmail : state.accountEmail,
        joinedAt: typeof action.joinedAt === "number" ? action.joinedAt : state.joinedAt,
        history: mergeSessionHistory(state.history, action.history),
        freeCaseClaims: Array.isArray(action.freeCaseClaims) ? action.freeCaseClaims : state.freeCaseClaims,
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
  removeItems: (ids: string[], sales?: Record<string, number>, leftVia?: InventoryLeftVia) => void;
  markWithdrawPending: (instanceId: string) => void;
  addHistory: (entry: Omit<HistoryEntry, "id" | "at">) => void;
  pushDrop: (drop: Partial<LiveDrop> & { skin?: Skin; caseName?: string }) => void;
  patchBattle: (battle: Battle) => void;
  bumpStat: (key: "openedCases" | "battles" | "upgrades" | "contracts" | "biggestWin", extra?: Partial<UserStats>) => void;
  setSetting: (key: "liveFeedOn" | "reduceMotion", value: boolean) => void;
  setCurrency: (code: CurrencyCode) => void;
  savePromo: (code: string) => Promise<boolean>;
  saveCasePromo: (code: string) => void;
  addFreeCaseClaim: (claim: FreeCaseClaimSummary) => void;
  consumeFreeCaseClaims: (caseId: string, count: number) => void;
  setTradeUrl: (url: string) => void;
  setAccountEmail: (email: string) => Promise<boolean>;
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
      for (const key of LEGACY_DEMO_KEYS) localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<State>;
        dispatch({
          type: "HYDRATE",
          payload: {
            liveFeedOn: parsed.liveFeedOn ?? true,
            reduceMotion: parsed.reduceMotion ?? false,
            displayCurrency: isValidCurrency(parsed.displayCurrency) ? parsed.displayCurrency : "USD",
            savedPromo: typeof parsed.savedPromo === "string" ? parsed.savedPromo : null,
            savedCasePromo: typeof parsed.savedCasePromo === "string" ? parsed.savedCasePromo : null,
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
    localStorage.setItem(PREFS_KEY, JSON.stringify(persistable(state)));
  }, [state]);

  useEffect(() => {
    if (state.displayCurrency) setDisplayCurrency(state.displayCurrency);
  }, [state.displayCurrency]);

  useEffect(() => {
    if (!state.hydrated) return;
    let cancelled = false;
    async function pullMe() {
      try {
        const res = await fetch("/api/me");
        const data = (await res.json()) as {
          ok?: boolean;
          guest?: boolean;
          user?: PublicUser | null;
          steam?: SteamIdentity;
          balance?: number;
          inventory?: InventoryItem[];
          bestDrop?: unknown;
          banned?: boolean;
          wagerRemainingUsd?: number;
          tradeUrl?: string;
          stats?: {
            openedCases?: number;
            upgrades?: number;
            contracts?: number;
            wageredUsd?: number;
            upgradesWon?: number;
            upgradesLost?: number;
          };
          history?: unknown;
          joinedAt?: number;
          email?: string | null;
          freeCaseClaims?: FreeCaseClaimSummary[];
        };
        if (cancelled) return;
        if (!data.ok) {
          dispatch({ type: "SESSION_READY" });
          return;
        }
        if (data.guest || !data.user) {
          dispatch({ type: "LOGOUT" });
          return;
        }
        dispatch({
          type: "SET_SESSION",
          user: data.user,
          steam: data.steam ?? DISCONNECTED_STEAM,
        });
        if (!Array.isArray(data.inventory) || typeof data.balance !== "number") return;
        dispatch({
          type: "APPLY_SERVER",
          balance: data.balance,
          inventory: data.inventory,
          bestDrop: parseBestDrop(data.bestDrop),
          banned: Boolean(data.banned),
          wagerRemainingUsd: typeof data.wagerRemainingUsd === "number" ? data.wagerRemainingUsd : undefined,
          tradeUrl: typeof data.tradeUrl === "string" ? data.tradeUrl : undefined,
          accountEmail: typeof data.email === "string" ? data.email : undefined,
          joinedAt: typeof data.joinedAt === "number" ? data.joinedAt : undefined,
          history: Array.isArray(data.history) ? parseHistoryEntries(data.history) : undefined,
          stats: data.stats,
          freeCaseClaims: Array.isArray(data.freeCaseClaims) ? data.freeCaseClaims : undefined,
        });
      } catch {
        if (!cancelled) dispatch({ type: "SESSION_READY" });
      }
    }
    void pullMe();
    const onFocus = () => void pullMe();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, [state.hydrated]);

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
    if (!state.hydrated) return;
    const params = new URLSearchParams(window.location.search);
    const auth = params.get("auth");
    if (!auth) return;
    if (auth === "ok") toast({ title: "Signed in with Steam", tone: "ok" });
    else if (auth === "local") toast({ title: "Local session", detail: "NovaPrime on this machine — not Steam.", tone: "ok" });
    else if (auth === "error") toast({ title: "Steam sign-in failed", detail: "Try again from the header.", tone: "err" });
    else if (auth === "cancel") toast({ title: "Steam sign-in cancelled", tone: "warn" });
    params.delete("auth");
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", next);
  }, [state.hydrated, toast]);

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
        if (!isInVault(item)) return sum;
        const market = marketValueUsd(item.id, item.wear, item.stickers);
        return market != null ? sum + market : sum;
      }, 0),
    [state.inventory, state.priceTick],
  );

  const spend = useCallback(
    (amount: number) => {
      if (!state.user) {
        toast({ title: "Sign in with Steam", detail: "Sign in to continue.", tone: "warn" });
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
        window.location.assign("/api/auth/steam");
      },
      logout: () => {
        void fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
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
          toast({ title: "Sign in with Steam", tone: "warn" });
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
          toast({ title: "Sign in with Steam", tone: "warn" });
          return false;
        }
        if (extra > 0 && state.balance < extra) {
          toast({ title: "Not enough balance", tone: "err" });
          return false;
        }
        dispatch({ type: "APPLY_UPGRADE", extra, removeIds, item });
        return true;
      },
      removeItems: (ids, sales, leftVia = "sell") => {
        dispatch({ type: "MARK_LEFT", ids, leftVia });
        void fetch("/api/persist/inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, sales, leftVia }),
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
      /** The server owns the code list, so nothing is stored until it accepts one. */
      savePromo: async (code) => {
        const normalized = code.trim().toUpperCase();
        if (!normalized) return false;
        try {
          const res = await fetch("/api/persist/promo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: normalized }),
          });
          const json = (await res.json()) as {
            ok?: boolean;
            already?: boolean;
            percentBonus?: number;
            message?: string;
          };
          if (!res.ok || !json.ok) {
            toast({
              title: "Code not accepted",
              detail: json.message ?? "That promo code is not valid.",
              tone: "err",
            });
            return false;
          }
          dispatch({ type: "SAVE_PROMO", code: normalized });
          toast({
            title: json.already ? "Promo already applied" : "Promo saved",
            detail: json.percentBonus
              ? `${normalized} · +${json.percentBonus}% on your next deposit`
              : `${normalized} · bonus on your next deposit`,
            tone: "ok",
          });
          return true;
        } catch {
          toast({ title: "Could not apply", detail: "Network error. Try again.", tone: "err" });
          return false;
        }
      },
      saveCasePromo: (code) => {
        dispatch({ type: "SAVE_CASE_PROMO", code });
      },
      addFreeCaseClaim: (claim) => dispatch({ type: "ADD_FREE_CLAIM", claim }),
      consumeFreeCaseClaims: (caseId, count) => dispatch({ type: "CONSUME_FREE_CLAIMS", caseId, count }),
      setTradeUrl: (url) => {
        dispatch({ type: "SET_TRADE_URL", value: url });
        void fetch("/api/persist/trade-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        }).catch(() => undefined);
      },
      setAccountEmail: async (email) => {
        const next = email.trim();
        try {
          const res = await fetch("/api/persist/email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: next }),
          });
          const json = (await res.json()) as { ok?: boolean; message?: string };
          if (!res.ok || !json.ok) {
            toast({
              title: "Email not saved",
              detail: json.message ?? "Check the address and try again.",
              tone: "err",
            });
            return false;
          }
        } catch {
          toast({ title: "Email not saved", detail: "Network error. Try again.", tone: "err" });
          return false;
        }
        dispatch({ type: "SET_EMAIL", value: next });
        return true;
      },
      beginSteamLogin: () => {
        window.location.assign("/api/auth/steam");
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
