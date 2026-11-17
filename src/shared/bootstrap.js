/** Runs synchronously in <head>, before CSS and application modules. No imports. */
export function bootstrapPage({ page, defaultTheme, responsiveMotion }) {
  const html = document.documentElement;
  let preference = defaultTheme;
  try {
    const saved = localStorage.getItem("ginkgo-theme");
    if (["light", "dark", "system"].includes(saved)) preference = saved;
  } catch { /* The configured theme still works with storage disabled. */ }
  const dark = preference === "dark" || (preference === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  html.style.colorScheme = dark ? "dark" : "light";
  if (page === "portal") {
    html.classList.add("portal-loading");
    html.dataset.portalBootTimer = String(setTimeout(() => {
      html.classList.remove("portal-loading");
      delete html.dataset.portalBootTimer;
    }, 4000));
    return;
  }
  try {
    const key = `ginkgo-${page}-arrival`;
    let arrival;
    try {
      const raw = sessionStorage.getItem(key);
      sessionStorage.removeItem(key);
      arrival = raw && JSON.parse(raw);
    } catch { /* Profile can fade in even without session storage. */ }
    // Profile has no paper geometry to hand off. Direct visits and reloads can
    // use the same gentle reveal without requiring a token from the portal.
    if (page === "profile") {
      const valid = arrival?.path === location.pathname + location.search &&
        Number.isFinite(arrival.time) && Date.now() - arrival.time >= 0 && Date.now() - arrival.time < 15000;
      arrival = { path: location.pathname + location.search, time: Date.now(),
        color: dark ? "#162028" : "#f8fafb", speed: valid ? arrival.speed : 1 };
    }
    const navigation = performance.getEntriesByType("navigation")[0];
    if (!arrival || (page !== "profile" && navigation?.type === "reload") || navigation?.type === "back_forward" ||
        arrival.path !== location.pathname + location.search ||
        !Number.isFinite(arrival.time) || Date.now() - arrival.time < 0 || Date.now() - arrival.time >= 15000 ||
        !responsiveMotion || matchMedia("(prefers-reduced-motion: reduce)").matches ||
        typeof arrival.color !== "string" || !CSS.supports("color", arrival.color)) return;
    html.style.setProperty(`--${page}-arrival-color`, arrival.color);
    html.dataset.arrivalSpeed = String(Math.max(.2, Math.min(3, Number(arrival.speed) || 1)));
    html.classList.add(`${page}-arriving`);
    html.dataset.arrivalTimeout = String(setTimeout(() => {
      html.classList.remove(`${page}-arriving`);
      html.style.removeProperty(`--${page}-arrival-color`);
      delete html.dataset.arrivalSpeed;
      delete html.dataset.arrivalTimeout;
    }, 5000));
  } catch { /* A failed handoff must never hide the document. */ }
}
