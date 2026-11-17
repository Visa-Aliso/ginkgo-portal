import { preferenceKeys, readPreference, writePreference } from "../shared/preferences.ts";

export const WIND_HOLD_MS = 700;
export const readLeavesPaused = () => readPreference(preferenceKeys.leavesPaused) === "true";

export interface WindControlOptions {
  initialPaused?: boolean;
  persist?: boolean;
}

interface WindActions {
  clear: () => void;
  pausedChanged: (paused: boolean) => void;
}
type Press = { kind: "pointer"; id: number; x: number; y: number; fired: boolean }
  | { kind: "keyboard"; key: string; fired: boolean };

/** All pages share the same gestures and paused-state presentation. */
export function bindWindControl(button: HTMLButtonElement, actions: WindActions, options: WindControlOptions = {}) {
  const readPaused = () => options.persist === false ? (options.initialPaused ?? false) : (options.initialPaused ?? readLeavesPaused());
  let paused = readPaused();
  let press: Press | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let suppressClick = false;
  const listeners: Array<() => void> = [];
  const listen = (target: EventTarget, type: string, handler: EventListener) => {
    target.addEventListener(type, handler);
    listeners.push(() => target.removeEventListener(type, handler));
  };
  function paint() {
    button.dataset.leavesPaused = String(paused);
    button.setAttribute("aria-pressed", String(paused));
    const label = paused
      ? "银杏叶已暂停；单击吹风，长按恢复生成"
      : "单击吹开银杏叶，长按暂停生成";
    button.setAttribute("aria-label", label);
    button.title = label;
  }
  function cancel() {
    clearTimeout(timer);
    timer = undefined;
    press = null;
    button.classList.remove("wind-holding");
  }
  function setPaused(next: boolean, persist: boolean) {
    if (paused === next) return;
    paused = next;
    if (persist && options.persist !== false) writePreference(preferenceKeys.leavesPaused, String(paused));
    paint();
    actions.pausedChanged(paused);
  }
  function start(next: Press) {
    cancel();
    if (button.disabled) return;
    suppressClick = false;
    press = next;
    button.classList.add("wind-holding");
    timer = setTimeout(() => {
      if (!press || button.disabled || document.hidden) { cancel(); return; }
      press.fired = true;
      button.classList.remove("wind-holding");
      setPaused(!paused, true);
    }, WIND_HOLD_MS);
  }
  const refresh = () => { cancel(); setPaused(readPaused(), false); };
  button.style.setProperty("--wind-hold-time", `${WIND_HOLD_MS}ms`);
  paint();

  listen(button, "pointerdown", event => {
    const e = event as PointerEvent;
    if (e.button !== 0 || !e.isPrimary || button.disabled) return;
    start({ kind: "pointer", id: e.pointerId, x: e.clientX, y: e.clientY, fired: false });
  });
  listen(window, "pointermove", event => {
    const e = event as PointerEvent;
    if (press?.kind !== "pointer" || press.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 14) {
      suppressClick = true;
      cancel();
    }
  });
  listen(window, "pointerup", event => {
    const e = event as PointerEvent;
    if (press?.kind !== "pointer" || press.id !== e.pointerId) return;
    suppressClick = press.fired;
    cancel();
  });
  listen(button, "pointerleave", () => {
    if (press?.kind === "pointer") { suppressClick = true; cancel(); }
  });
  listen(window, "pointercancel", () => { cancel(); suppressClick = false; });
  listen(button, "click", event => {
    if (button.disabled || suppressClick || press?.kind === "keyboard") {
      event.preventDefault();
      suppressClick = false;
      return;
    }
    actions.clear();
  });
  listen(button, "contextmenu", event => event.preventDefault());
  listen(button, "keydown", event => {
    const e = event as KeyboardEvent;
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    if (!e.repeat) start({ kind: "keyboard", key: e.key, fired: false });
  });
  listen(button, "keyup", event => {
    const e = event as KeyboardEvent;
    if (press?.kind !== "keyboard" || press.key !== e.key) return;
    e.preventDefault();
    const shortPress = !press.fired;
    cancel();
    if (shortPress && !button.disabled) actions.clear();
  });
  listen(button, "blur", () => { cancel(); suppressClick = false; });
  listen(window, "blur", () => { cancel(); suppressClick = false; });
  listen(window, "pagehide", () => { cancel(); suppressClick = false; });
  listen(window, "pageshow", refresh);
  listen(document, "visibilitychange", () => { if (document.hidden) cancel(); });
  listen(window, "storage", event => {
    const e = event as StorageEvent;
    if (options.persist !== false && (e.key === preferenceKeys.leavesPaused || e.key === null)) refresh();
  });
  const observer = new MutationObserver(() => { if (button.disabled) cancel(); });
  observer.observe(button, { attributes: true, attributeFilter: ["disabled"] });
  return {
    get paused() { return paused; },
    refresh,
    dispose() { cancel(); observer.disconnect(); listeners.forEach(remove => remove()); },
  };
}
