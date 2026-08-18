import { uid } from "@/lib/utils";
import type { HistoryEntry } from "@/lib/types";

export function caseOpenHistory(input: {
  caseName: string;
  skinName: string;
  price: number;
  payout: number;
}): HistoryEntry {
  return {
    id: uid("h"),
    kind: "open",
    title: `Opened ${input.caseName}`,
    detail: input.skinName,
    amount: -input.price,
    at: Date.now(),
  };
}
