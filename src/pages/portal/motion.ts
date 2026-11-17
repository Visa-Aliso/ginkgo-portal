import { leaveForProfile } from "./profile-handoff.ts";
import { expandNoteSurface } from "./note-handoff.ts";
import type { SiteConfig, EntryId } from "../../config/site";
import { required, destination } from "../../shared/dom";
import { initTheme } from "../../shared/theme.ts";
import { rememberPageArrival, warmContentPage } from "../../shared/page-navigation";

type Transform = {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rz: number;
  scale: number;
};
type Pose = Transform & { detail: number; gazeX: number; gazeY: number };
interface Part {
  el: HTMLAnchorElement;
  i: number;
  cx: number;
  cy: number;
  rotation: number;
  pos: Pose;
  target: Pose;
  velocity: Pose;
  pointer: { x: number; y: number };
  drag: {
    startX: number;
    startY: number;
    x: number;
    y: number;
    moved: number;
  } | null;
  ignoreClick: boolean;
}

export function initPortal(root: HTMLElement, siteConfig: SiteConfig) {
  const page = required(root, ".qp-page");
  const stage = required(root, ".qp-stage");
  const announcement = required(root, ".qp-announcement");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const themeButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-theme-choice]"),
  );
  const themeTrigger = required<HTMLButtonElement>(root, ".qp-theme-trigger");

  const config = siteConfig.motion;
  const fields = [
    "x",
    "y",
    "rx",
    "ry",
    "rz",
    "scale",
    "detail",
    "gazeX",
    "gazeY",
  ] as const;
  const parts: Part[] = Array.from(
    root.querySelectorAll<HTMLAnchorElement>(".qp-window"),
  ).map((el, i) => ({
    el,
    i,
    cx: 0,
    cy: 0,
    rotation: [-7, 7, -5][i],
    pos: {
      x: 0,
      y: 0,
      rx: 0,
      ry: 0,
      rz: [-7, 7, -5][i],
      scale: 1,
      detail: 0,
      gazeX: 0,
      gazeY: 0,
    },
    target: {
      x: 0,
      y: 0,
      rx: 0,
      ry: 0,
      rz: [-7, 7, -5][i],
      scale: 1,
      detail: 0,
      gazeX: 0,
      gazeY: 0,
    },
    velocity: {
      x: 0,
      y: 0,
      rx: 0,
      ry: 0,
      rz: 0,
      scale: 0,
      detail: 0,
      gazeX: 0,
      gazeY: 0,
    },
    pointer: { x: 0, y: 0 },
    drag: null,
    ignoreClick: false,
  }));
  let active = -1,
    raf = 0,
    lastFrame = 0,
    entering = false,
    pageActive = true;
  let cancelEntry: (() => void) | null = null,
    layoutPending = false;
  const gaze = { x: 0, y: 0 },
    flow = { x: 0, y: 0 };
  const epoch = performance.now();
  let inView = true;
  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v));
  const motion = () => config.responsiveMotion && !reduced.matches;
  const theme = initTheme(root, {
    defaultTheme: siteConfig.defaultTheme,
    blocked: () => entering,
    beforeChange(resolved) {
      if (entering && page.dataset.theme !== resolved) cancelEntry?.();
    },
  });
  const closeThemeMenu = theme.close;
  root.addEventListener("ginkgo:gust", () => {
    announcement.textContent = "一阵风吹开了落叶。";
  });
  function paint(p: Part) {
    for (const f of fields) {
      const name = f === "gazeX" ? "gaze-x" : f === "gazeY" ? "gaze-y" : f;
      const unit =
        f === "scale" || f === "detail" ? "" : f.startsWith("r") ? "deg" : "px";
      p.el.style.setProperty("--" + name, p.pos[f] + unit);
    }
  }
  function frame(now: number) {
    raf = 0;
    if (entering) {
      lastFrame = 0;
      return;
    }
    if (!pageActive || !inView || document.hidden) {
      lastFrame = 0;
      return;
    }
    const dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.028) : 1 / 60;
    lastFrame = now;
    let moving = false;
    const drifting = motion() && config.breeze;
    const seconds = (now - epoch) / 1000;
    for (const p of parts) {
      const stiffness = [180, 205, 158][p.i] / config.softness;
      const damping = [20, 22, 18.5][p.i] / Math.sqrt(config.softness);
      const phase = seconds * 0.72 + p.i * 2.1;
      const amplitude = drifting && !p.drag ? (active === p.i ? 0.28 : 1) : 0;
      const ambient: Partial<Pose> = {
        x: Math.cos(phase * 0.67) * 2.7 * amplitude,
        y: Math.sin(phase) * 5.5 * amplitude,
        rz: Math.sin(phase * 0.78) * 0.75 * amplitude,
      };
      for (const f of fields) {
        if (!motion()) {
          p.pos[f] = p.target[f];
          p.velocity[f] = 0;
          continue;
        }
        const target = p.target[f] + (ambient[f] || 0);
        const force = (target - p.pos[f]) * stiffness - p.velocity[f] * damping;
        p.velocity[f] += force * dt;
        p.pos[f] += p.velocity[f] * dt;
        const threshold = f === "scale" || f === "detail" ? 0.0003 : 0.018;
        if (
          Math.abs(target - p.pos[f]) > threshold ||
          Math.abs(p.velocity[f]) > threshold * 8
        )
          moving = true;
        else {
          p.pos[f] = target;
          p.velocity[f] = 0;
        }
      }
      paint(p);
      p.el.style.setProperty(
        "--ribbon",
        drifting ? Math.sin(phase + 0.8) * 1.8 + "deg" : "0deg",
      );
      if (p.i === 1) {
        const moment = (seconds + 5.6) % 7.8;
        const blink =
          drifting && moment < 0.22
            ? Math.sin((Math.PI * moment) / 0.22) ** 2
            : 0;
        p.el.style.setProperty("--blink", String(blink));
      }
    }
    if ((moving || drifting) && root.isConnected)
      raf = requestAnimationFrame(frame);
    else lastFrame = 0;
  }
  function wake() {
    if (!raf && pageActive && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function retarget() {
    if (entering) return;
    const enabled = motion();
    for (const p of parts) {
      const selected = active === p.i;
      const nudge =
        active >= 0 && !selected && enabled ? Math.sign(p.i - active) * 7 : 0;
      const driftX = enabled ? flow.x * [4, 6, 8][p.i] : 0;
      const driftY = enabled ? flow.y * [2, 3, 4][p.i] : 0;
      p.target.x = p.drag
        ? p.drag.x
        : nudge + driftX + (selected && enabled ? p.pointer.x * 3 : 0);
      p.target.y = p.drag ? p.drag.y : (selected && enabled ? -13 : 0) + driftY;
      p.target.rx = selected && enabled ? -p.pointer.y * 5 : 0;
      p.target.ry = selected && enabled ? p.pointer.x * 5 : 0;
      p.target.rz =
        p.rotation +
        (selected && enabled ? -p.rotation * 0.5 + p.pointer.x * 1.5 : 0);
      p.target.scale = selected && enabled ? 1.025 : 1;
      p.target.detail = selected && enabled ? 1 : 0;
      p.target.gazeX = p.i === 1 && enabled ? gaze.x : 0;
      p.target.gazeY = p.i === 1 && enabled ? gaze.y : 0;
      p.el.style.zIndex = selected ? "4" : String(3 - p.i);
    }
    wake();
  }
  function layout() {
    if (entering) {
      layoutPending = true;
      cancelEntry?.();
      return;
    }
    const width = stage.clientWidth;
    const mobile = width < 555;
    const height = mobile ? 610 : 490;
    stage.style.height = height + "px";
    const s = Math.min(1, width / 760);
    const dims = mobile
      ? [
          [Math.min(242, width * 0.76), Math.min(174, width * 0.55), 0.43, 136],
          [Math.min(205, width * 0.56), Math.min(182, width * 0.5), 0.64, 310],
          [Math.min(238, width * 0.66), Math.min(174, width * 0.49), 0.43, 506],
        ]
      : [
          [248 * s, 176 * s, 0.25, 254],
          [224 * s, 198 * s, 0.64, 142],
          [250 * s, 174 * s, 0.72, 375],
        ];
    parts.forEach((p, i) => {
      const [w, h, x, y] = dims[i];
      p.cx = x * width;
      p.cy = y;
      p.el.style.width = w + "px";
      p.el.style.height = h + "px";
      p.el.style.setProperty("--tile-scale", String(w / 240));
      p.el.style.left = p.cx + "px";
      p.el.style.top = p.cy + "px";
      p.el.style.setProperty("--rz", p.rotation + "deg");
    });
    retarget();
  }
  function localPointer(p: Part, e: PointerEvent) {
    const bounds = stage.getBoundingClientRect();
    p.pointer.x = clamp(
      (e.clientX - bounds.left - p.cx) / (p.el.offsetWidth * 0.5),
      -1,
      1,
    );
    p.pointer.y = clamp(
      (e.clientY - bounds.top - p.cy) / (p.el.offsetHeight * 0.5),
      -1,
      1,
    );
  }
  function transformFor(v: Transform) {
    return `translate(-50%,-50%) translate3d(${v.x}px,${v.y}px,0) rotateX(${v.rx}deg) rotateY(${v.ry}deg) rotateZ(${v.rz}deg) scale(${v.scale})`;
  }
  async function openWindow(p: Part) {
    if (entering || p.ignoreClick) {
      p.ignoreClick = false;
      return;
    }
    entering = true;
    const targetUrl = destination(siteConfig.entries[p.el.dataset.entry as EntryId].url);
    if ((p.i === 1 || p.i === 2) && targetUrl) warmContentPage(targetUrl, p.i === 1 ? "profile" : "notes");
    closeThemeMenu();
    themeTrigger.disabled = true;
    themeButtons.forEach((button) => (button.disabled = true));
    parts.forEach((item) => {
      item.el.style.setProperty("--blink", "0");
      item.el.style.setProperty("--ribbon", "0deg");
    });
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lastFrame = 0;
    const animated = motion(),
      animations: Animation[] = [];
    let navigating = false;
    let aborted = false,
      restored = false;
    const run = (
      el: HTMLElement,
      keyframes: Keyframe[],
      options: KeyframeAnimationOptions = {},
    ) => {
      if (aborted) return Promise.reject(new Error("Entry cancelled"));
      const animation = el.animate(keyframes, {
        duration: 500,
        easing: "cubic-bezier(.22,.65,.18,1)",
        fill: "forwards",
        ...options,
      });
      animation.playbackRate = Math.max(
        0.2,
        Math.min(3, config.transitionSpeed),
      );
      animations.push(animation);
      return animation.finished;
    };
    cancelEntry = () => {
      aborted = true;
      animations.forEach((a) => a.cancel());
    };
    const bounds = page.getBoundingClientRect(),
      stageBounds = stage.getBoundingClientRect();
    const width = p.el.offsetWidth,
      height = p.el.offsetHeight;
    const centerX = bounds.width * 0.5 + bounds.left - stageBounds.left;
    const centerY = bounds.height * 0.5 + bounds.top - stageBounds.top;
    const fitScale =
      p.i === 0
        ? Math.min(
            1.18,
            (stage.clientWidth - 44) / width,
            (stage.clientHeight - 55) / (height * 1.45),
          )
        : Math.min(
            1.24,
            (stage.clientWidth - 40) / width,
            (stage.clientHeight - 40) / height,
          );
    const centered = {
      x: centerX - p.cx,
      y: centerY - p.cy + (p.i === 0 ? height * 0.225 * fitScale : 0),
      rx: 0,
      ry: 0,
      rz: 0,
      scale: fitScale,
    };
    const zoomed = {
      x: centerX - p.cx,
      y: centerY - p.cy,
      rx: 0,
      ry: 0,
      rz: 0,
      // Keep the detailed 3D paper small; a flat veil performs the full-page zoom.
      scale: fitScale * 1.45,
    };
    const source =
      p.i === 0
        ? required(p.el, ".qp-article-sheet")
        : required(p.el, ".qp-surface");
    const veil = document.createElement("div");
    veil.className = "qp-veil";
    veil.setAttribute("aria-hidden", "true");
    veil.style.background = getComputedStyle(p.i === 1 ? document.documentElement : source).backgroundColor;
    page.appendChild(veil);
    page.classList.add("qp-entering");
    p.el.classList.add("qp-opening");
    p.el.style.zIndex = "10";
    announcement.textContent = "正在打开 " + p.el.dataset.site + "。";
    function restoreScene() {
      if (restored) return;
      restored = true;
      animations.forEach((a) => a.cancel());
      active = -1;
      gaze.x = 0;
      gaze.y = 0;
      flow.x = 0;
      flow.y = 0;
      for (const item of parts) {
        item.drag = null;
        item.pointer = { x: 0, y: 0 };
        item.el.classList.remove("qp-opening", "qp-dragging", "qp-handoff");
        for (const f of fields) {
          const v = f === "rz" ? item.rotation : f === "scale" ? 1 : 0;
          item.pos[f] = v;
          item.target[f] = v;
          item.velocity[f] = 0;
        }
        paint(item);
        item.el.style.zIndex = String(3 - item.i);
      }
      page.classList.remove("qp-entering");
    }
    function finishEntry() {
      restoreScene();
      animations.forEach((a) => a.cancel());
      veil.remove();
      entering = false;
      cancelEntry = null;
      lastFrame = 0;
      themeButtons.forEach((button) => (button.disabled = false));
      themeTrigger.disabled = false;
      if (layoutPending) {
        layoutPending = false;
        layout();
      } else retarget();
    }
    try {
      if (animated && p.i === 1) {
        await leaveForProfile(veil, run);
      } else if (animated) {
        const phase: Promise<Animation>[] = [];
        for (const other of parts) {
          if (other === p) continue;
          const direction = other.cx < centerX ? -1 : 1;
          phase.push(
            run(
              other.el,
              [
                { opacity: 1, transform: transformFor(other.pos) },
                {
                  opacity: 0,
                  transform: transformFor({
                    ...other.pos,
                    x: other.pos.x + direction * 75,
                    y: other.pos.y + 25,
                    scale: 0.94,
                  }),
                },
              ],
              { duration: 470 },
            ),
          );
        }
        phase.push(
          run(
            p.el,
            [
              { transform: transformFor(p.pos) },
              { transform: transformFor(centered) },
            ],
            { duration: 620 },
          ),
        );
        if (p.i === 0) {
          const flap = required(p.el, ".qp-article-flap");
          phase.push(
            run(
              flap,
              [
                { transform: getComputedStyle(flap).transform },
                { transform: "translateZ(1px) rotateX(4deg)", offset: 0.84 },
                { transform: "translateZ(1px) rotateX(0deg)" },
              ],
              {
                delay: 150,
                duration: 980,
                easing: "cubic-bezier(.28,.04,.24,1)",
              },
            ),
          );
          phase.push(
            run(
              required(p.el, ".qp-article-crease"),
              [{ opacity: 1 }, { opacity: 0.25 }],
              { delay: 650, duration: 440 },
            ),
          );
        } else {
          const back = required(p.el, ".qp-note-back"),
            middle = required(p.el, ".qp-note-middle"),
            front = required(p.el, ".qp-note-front");
          phase.push(
            run(
              back,
              [
                { transform: getComputedStyle(back).transform },
                { transform: "translate3d(-50px,25px,-5px) rotate(-24deg)" },
              ],
              { delay: 120, duration: 690 },
            ),
          );
          phase.push(
            run(
              middle,
              [
                { transform: getComputedStyle(middle).transform },
                { transform: "translate3d(42px,12px,0) rotate(21deg)" },
              ],
              { delay: 260, duration: 690 },
            ),
          );
          phase.push(
            run(
              front,
              [
                {
                  transform: getComputedStyle(front).transform,
                  clipPath: getComputedStyle(front).clipPath,
                },
                {
                  transform:
                    "translate3d(0,-16px,32px) rotateX(-12deg) rotateZ(-3deg)",
                  clipPath: "polygon(0 0,100% 0,100% 100%,100% 100%,0 100%)",
                },
              ],
              { delay: 380, duration: 740 },
            ),
          );
          phase.push(
            run(
              required(p.el, ".qp-note-fold"),
              [{ opacity: 1 }, { opacity: 0 }],
              { delay: 510, duration: 440 },
            ),
          );
        }
        await Promise.all(phase);
        if (aborted) throw new Error("Entry cancelled");
        if (p.i === 2) {
          await expandNoteSurface(p.el, required(p.el, ".qp-note-front"), veil, page, run);
        } else {
          const paperBounds = p.el.getBoundingClientRect();
          const veilFrom = `translate(${paperBounds.left - bounds.left}px, ${paperBounds.top - bounds.top}px) scale(${paperBounds.width / bounds.width}, ${paperBounds.height / bounds.height})`;
          const approach = [
            run(
              p.el,
              [
                { transform: transformFor(centered) },
                { transform: transformFor(zoomed) },
              ],
              { duration: 850, easing: "cubic-bezier(.48,.02,.25,1)" },
            ),
          ];
          const fading = p.el.querySelectorAll<HTMLElement>(".qp-article-content,.qp-article-print");
          for (const el of fading)
            approach.push(
              run(el, [{ opacity: 1 }, { opacity: 0 }], {
                delay: 330,
                duration: 450,
              }),
            );
          approach.push(
            run(veil, [
              { transform: veilFrom, opacity: 0 },
              { opacity: 1, offset: .3 },
              { transform: "none", opacity: 1 },
            ], {
              duration: 850,
              easing: "cubic-bezier(.48,.02,.25,1)",
            }),
          );
          await Promise.all(approach);
        }
      } else {
        await run(veil, [{ opacity: 0 }, { opacity: 1 }], {
          duration: 90,
          easing: "linear",
        });
      }
      if (aborted) throw new Error("Entry cancelled");
      const url = targetUrl;
      if (url) {
        if ((p.i === 1 || p.i === 2) && animated) rememberPageArrival(url, veil.style.background, config.transitionSpeed, p.i === 1 ? "profile" : "notes");
        // Keep the final frame until the new document takes over. The former
        // unconditional finally block restored the portal before navigation.
        navigating = true;
        veil.style.opacity = "1";
        // The opaque static veil keeps the handoff frame while old compositor
        // animations and enlarged paper layers can be released immediately.
        restoreScene();
        cancelEntry = null;
        window.addEventListener("pageshow", finishEntry, { once: true });
        try { window.location.assign(url); }
        catch (error) {
          navigating = false;
          window.removeEventListener("pageshow", finishEntry);
          throw error;
        }
        return;
      }
      veil.style.opacity = "1";
      restoreScene();
      await run(veil, [{ opacity: 1 }, { opacity: 1 }], {
        duration: 220,
        easing: "linear",
      });
      await run(veil, [{ opacity: 1 }, { opacity: 0 }], {
        duration: animated ? 380 : 90,
        easing: "ease-out",
      });
      announcement.textContent =
        p.el.dataset.site + " 进入动画已完成；当前是未绑定地址的演示。";
    } catch (error) {
      if (!aborted) {
        announcement.textContent = "动画未能完成，已恢复入口。";
        console.error(error);
      }
    } finally {
      if (!navigating) finishEntry();
    }
  }
  page.addEventListener("pointermove", (e) => {
    if (entering || e.pointerType === "touch") return;
    const base = stage.getBoundingClientRect(),
      x = e.clientX - base.left,
      y = e.clientY - base.top;
    flow.x = clamp((x / stage.clientWidth - 0.5) * 2, -1, 1);
    flow.y = clamp((y / stage.clientHeight - 0.5) * 2, -1, 1);
    if (!parts.some((item) => item.drag)) {
      const contains = (item: Part, pad: number) =>
        Math.abs(x - item.cx) <= item.el.offsetWidth / 2 + pad &&
        Math.abs(y - item.cy) <= item.el.offsetHeight / 2 + pad;
      if (active < 0 || !contains(parts[active], 25))
        active = parts.findIndex((item) => contains(item, 9));
      if (active >= 0) localPointer(parts[active], e);
    }
    const bounds = parts[1].el.getBoundingClientRect();
    gaze.x =
      clamp((e.clientX - bounds.left - bounds.width * 0.35) / 80, -1, 1) * 4;
    gaze.y =
      clamp((e.clientY - bounds.top - bounds.height * 0.3) / 100, -1, 1) * 3;
    retarget();
  });
  page.addEventListener("pointerleave", () => {
    if (entering) return;
    gaze.x = 0;
    gaze.y = 0;
    flow.x = 0;
    flow.y = 0;
    if (!parts.some((item) => item.drag)) active = -1;
    retarget();
  });
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && entering) {
      e.preventDefault();
      cancelEntry?.();
    }
  });
  for (const p of parts) {
    p.el.addEventListener("pointerenter", (e) => {
      if (entering || e.pointerType === "touch") return;
      active = p.i;
      localPointer(p, e);
      retarget();
    });
    p.el.addEventListener("focus", () => {
      if (!entering) {
        active = p.i;
        retarget();
      }
    });
    p.el.addEventListener("blur", () => {
      if (!p.drag && active === p.i) {
        active = -1;
        retarget();
      }
    });
    p.el.addEventListener("pointerdown", (e) => {
      if (entering || e.button !== 0) return;
      active = p.i;
      p.ignoreClick = false;
      p.drag = { startX: e.clientX, startY: e.clientY, x: 0, y: 0, moved: 0 };
      p.el.setPointerCapture(e.pointerId);
      localPointer(p, e);
      retarget();
    });
    p.el.addEventListener("pointermove", (e) => {
      if (entering) return;
      localPointer(p, e);
      if (p.drag) {
        const dx = e.clientX - p.drag.startX,
          dy = e.clientY - p.drag.startY;
        p.drag.moved = Math.max(p.drag.moved, Math.hypot(dx, dy));
        const limit = stage.clientWidth < 555 ? 10 : 38;
        p.drag.x = Math.tanh(dx / 100) * limit;
        p.drag.y = Math.tanh(dy / 100) * limit;
        p.el.classList.toggle("qp-dragging", p.drag.moved > 5);
      }
      if (active === p.i) retarget();
    });
    function release(e: PointerEvent, cancelled = false) {
      if (!p.drag) return;
      p.ignoreClick = cancelled || p.drag.moved > 5;
      p.drag = null;
      p.el.classList.remove("qp-dragging");
      if (p.el.hasPointerCapture(e.pointerId))
        p.el.releasePointerCapture(e.pointerId);
      active = -1;
      p.pointer = { x: 0, y: 0 };
      retarget();
    }
    p.el.addEventListener("pointerup", (e) => release(e));
    p.el.addEventListener("pointercancel", (e) => release(e, true));
    p.el.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
        return;
      e.preventDefault();
      void openWindow(p);
    });
    p.el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") p.ignoreClick = false;
    });
  }
  window.addEventListener("pageshow", (event) => {
    pageActive = true;
    if (event.persisted) {
      cancelEntry?.();
      retarget();
    }
  });
  layout();
  // Layout depends on width. Ignore the height we set ourselves, and perform
  // writes in the next frame instead of inside ResizeObserver delivery.
  let lastLayoutWidth = stage.clientWidth;
  let layoutFrame = 0;
  const observer = new ResizeObserver(([entry]) => {
    if (!pageActive || document.hidden) return;
    const width = entry.contentRect.width;
    if (Math.abs(width - lastLayoutWidth) < 0.5) return;
    lastLayoutWidth = width;
    if (!layoutFrame) layoutFrame = requestAnimationFrame(() => { layoutFrame = 0; layout(); });
  });
  observer.observe(stage);
  window.addEventListener("pagehide", () => {
    pageActive = false;
    if (raf) cancelAnimationFrame(raf);
    if (layoutFrame) cancelAnimationFrame(layoutFrame);
    raf = layoutFrame = 0;
    lastFrame = 0;
  });
  const visibilityObserver = new IntersectionObserver(
    (entries) => {
      inView = entries[0].isIntersecting;
      if (inView) wake();
      else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
        lastFrame = 0;
      }
    },
    { threshold: 0 },
  );
  visibilityObserver.observe(root);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) wake();
    else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      lastFrame = 0;
    }
  });
  reduced.addEventListener("change", () => {
    if (reduced.matches && entering) cancelEntry?.();
    retarget();
  });
}
