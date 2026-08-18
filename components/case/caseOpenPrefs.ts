export type CaseOpenPrefs = {
  skip: boolean;
  fast: boolean;
  sound: boolean;
};

export const CASE_OPEN_PREFS_KEY = "prismloot-case-open-prefs-v1";

const DEFAULTS: CaseOpenPrefs = { skip: false, fast: false, sound: false };

export function readCaseOpenPrefs(): CaseOpenPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(CASE_OPEN_PREFS_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<CaseOpenPrefs>;
    return {
      skip: Boolean(parsed.skip),
      fast: Boolean(parsed.fast),
      sound: Boolean(parsed.sound),
    };
  } catch {
    return DEFAULTS;
  }
}

export function writeCaseOpenPrefs(prefs: CaseOpenPrefs) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CASE_OPEN_PREFS_KEY, JSON.stringify(prefs));
}
