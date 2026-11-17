/** Browser preferences must never prevent either page from starting. */
export const preferenceKeys = {
  theme: "ginkgo-theme",
  leavesPaused: "ginkgo-leaves-paused",
} as const;

export function readPreference(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function writePreference(key: string, value: string): boolean {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}
