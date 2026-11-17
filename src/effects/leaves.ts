import { makeLeafSprite, releaseLeafSprites, type LeafSprite } from "./leaf-sprites.ts";
import { seededRandom } from "./random.ts";
import { fallPose, leafSurfaceRatios, type Fall } from "./leaf-motion.ts";
import type { LeafConfig } from "../config/site";
import { required } from "../shared/dom.ts";
import { bindWindControl, readLeavesPaused, type WindControlOptions } from "./wind-control.ts";

interface Point {
  x: number;
  y: number;
}
interface Gust extends Point {
  time: number;
}
interface Blocked extends Point {
  id: number;
}
interface Leaf extends Point {
  size: number;
  sprite: number;
  angle: number;
  spin: number;
  vx: number;
  vy: number;
  z: number;
  vz: number;
  phase: number;
  alive: boolean;
  sweeping: boolean;
  returnAt: number;
  sx: number;
  sy: number;
  viewAngle: number;
  opacity: number;
  arrival?: Fall;
}

interface LeafInteractionOptions {
  windControl?: WindControlOptions;
  canopy?: boolean;
  target?: HTMLElement;
  cardSelector?: string;
  ignoreSelector?: string;
  enabled?: () => boolean;
}

export function initLeaves(root: HTMLElement, settings: LeafConfig, interaction: LeafInteractionOptions = {}) {
  if (!settings.enabled) {
    required(root, ".qp-wind-button").hidden = true;
    return;
  }
  const page = required(root, ".qp-page"),
    canvas = required<HTMLCanvasElement>(root, ".qp-leaves"),
    canopy = required<HTMLCanvasElement>(root, ".qp-canopy");
  const hitCanvas = document.createElement("canvas");
  hitCanvas.width = hitCanvas.height = 1; // Hit testing needs a context, not a bitmap.
  const ctx = canvas.getContext("2d")!,
    bg = canopy.getContext("2d")!,
    hitCtx = hitCanvas.getContext("2d")!;
  const windButton = required<HTMLButtonElement>(root, ".qp-wind-button"),
    reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const eventTarget = interaction.target ?? page;
  const cardSelector = interaction.cardSelector ?? ".qp-window";
  const ignoreSelector = interaction.ignoreSelector ?? ".qp-toolbar";
  const ignoresPointer = (event: PointerEvent) =>
    interaction.enabled?.() === false ||
    page.classList.contains("qp-entering") ||
    Boolean((event.target as Element).closest(ignoreSelector));
  if (!ctx || !bg || !hitCtx) return;
  const probe = document.createElement("span");
  probe.className = "qp-leaf-probe";
  probe.setAttribute("aria-hidden", "true");
  page.appendChild(probe);
  const clamp = (v: number, a: number, b: number) =>
    Math.max(a, Math.min(b, v));
  let random = seededRandom(63127);
  const palette: Record<string, string> = {};
  let sprites: LeafSprite[] = [],
    leaves: Leaf[] = [],
    order: Leaf[] = [],
    gusts: Gust[] = [];
  let width = 0,
    height = 0,
    dpr = 1,
    raf = 0,
    wakeTimer = 0,
    suspendedAt: number | null = null,
    lastTime = 0,
    visible = true,
    pageActive = true,
    nextBreeze = 0,
    clearUntil = 0;
  let blocked: Blocked | null = null,
    suppressClick: (Blocked & { until: number }) | null = null,
    lastPointer: (Point & { t: number }) | null = null,
    lastBrush = 0;
  let nextRefill = 0;
  let canopyDpr = 1;
  const hasCanopy = interaction.canopy !== false;
  let generationPaused = interaction.windControl?.initialPaused ?? readLeavesPaused();

  const color = (name: string) => {
    probe.style.color = "var(--leaf-" + name + ")";
    return getComputedStyle(probe).color;
  };
  const surfacePoint = (e: PointerEvent) => {
    const r = page.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  function releaseSurfaces() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    clearTimeout(wakeTimer);
    wakeTimer = 0;
    lastTime = 0;
    if (suspendedAt === null) suspendedAt = performance.now() / 1000;
    ctx.clearRect(0, 0, width, height);
    bg.clearRect(0, 0, width, height);
    canvas.width = canvas.height = canopy.width = canopy.height = 1;
    releaseLeafSprites(sprites);
    // Retain the tiny physics state; reallocating bitmaps must not teleport leaves.
    order = [];
    gusts = [];
  }
  function isEmpty() { return !leaves.some(leaf => leaf.alive) && gusts.length === 0; }
  function updatePalette() {
    if (!pageActive || !width || document.hidden || (generationPaused && isEmpty())) return;
    for (const name of [
      "gold",
      "amber",
      "olive",
      "highlight",
      "shade",
      "vein",
      "stem",
      "canopy",
      "wind",
    ])
      palette[name] = color(name);
    releaseLeafSprites(sprites);
    sprites = Array.from({ length: 6 }, (_, i) => makeLeafSprite(i, palette));
    drawCanopy();
    render(performance.now() / 1000);
  }
  function drawCanopy() {
    if (!hasCanopy || !width || !sprites.length) return;
    bg.setTransform(canopyDpr, 0, 0, canopyDpr, 0, 0);
    bg.clearRect(0, 0, width, height);
    bg.save();
    bg.filter = "blur(6px)";
    bg.strokeStyle = palette.canopy;
    bg.globalAlpha = page.dataset.theme === "dark" ? 0.075 : 0.1;
    bg.lineWidth = 3;
    bg.beginPath();
    bg.moveTo(width + 35, -35);
    bg.bezierCurveTo(width - 20, 35, width - 100, 63, width - 210, 95);
    bg.moveTo(width - 55, 34);
    bg.quadraticCurveTo(width - 70, 100, width - 105, 155);
    bg.moveTo(width - 120, 65);
    bg.quadraticCurveTo(width - 172, 8, width - 240, -18);
    bg.stroke();
    const shapes = [
      [0.98, 0.12, 85, -0.9],
      [0.91, 0.2, 72, 0.4],
      [0.84, 0.12, 77, 1.2],
      [0.77, 0.04, 68, -0.6],
      [1.02, 0.31, 92, 1.4],
      [-0.015, 0.79, 76, 0.5],
      [0.04, 0.92, 65, 2.3],
    ];
    for (const [x, y, size, angle] of shapes) {
      bg.save();
      bg.translate(width * x, height * y);
      bg.rotate(angle);
      bg.scale(size, size);
      bg.fillStyle = palette.canopy;
      bg.globalAlpha = page.dataset.theme === "dark" ? 0.045 : 0.065;
      bg.fill(sprites[2].path);
      bg.restore();
    }
    bg.restore();
  }
  function makeLeaf(
    x: number,
    y: number,
    size: number,
    index: number,
    air = false,
  ): Leaf {
    return {
      x,
      y,
      size,
      sprite: index % 6,
      angle: (random() - 0.5) * 5.8,
      spin: air ? (random() - 0.5) * 0.5 : 0,
      vx: air ? 12 + random() * 22 : 0,
      vy: air ? 9 + random() * 14 : 0,
      z: air ? 0.45 + random() * 0.5 : 0,
      vz: 0,
      phase: random() * 6.28,
      alive: true,
      sweeping: false,
      returnAt: 0,
      sx: 1,
      sy: 1,
      viewAngle: 0,
      opacity: 1,
    };
  }
  function seedLeaves(cleared = false) {
    random = seededRandom(63127);
    leaves = [];
    gusts = [];
    const small = width < settings.mobileBreakpoint,
      count = Math.max(
        0,
        Math.min(
          160,
          Math.round(small ? settings.mobileCount : settings.desktopCount),
        ),
      ),
      scale = (small ? 0.76 : 1) * settings.size;
    const base = page.getBoundingClientRect(),
      cards = [...root.querySelectorAll<HTMLElement>(cardSelector)].map((e) =>
        e.getBoundingClientRect(),
      );
    const placements = [
      [0, 0.72, 0.3, 39],
      [0, 0.13, 0.76, 31],
      [1, 0.81, 0.18, 35],
      [2, 0.72, 0.29, 39],
      [2, 0.23, 0.72, 33],
    ];
    placements.slice(0, count).forEach(([i, x, y, size], n) => {
      const b = cards[i];
      if (!b || b.bottom < base.top || b.top > base.bottom) return;
      leaves.push(
        makeLeaf(
          b.left - base.left + b.width * x,
          b.top - base.top + b.height * y,
          size * scale,
          n,
          false,
        ),
      );
    });
    const edges = [
      [0.08, 0.26],
      [0.15, 0.64],
      [0.9, 0.6],
      [0.91, 0.88],
      [0.36, 0.91],
      [0.74, 0.14],
      [0.07, 0.89],
      [0.91, 0.34],
      [0.44, 0.12],
      [0.46, 0.8],
      [0.26, 0.54],
      [0.61, 0.96],
    ];
    const placedCount = leaves.length;
    for (let i = placedCount; i < count; i++) {
      const edge = edges[(i - placedCount) % edges.length];
      const air = i >= count - 5;
      const x = clamp(
        width * (edge[0] + (random() - 0.5) * 0.16),
        5,
        width - 5,
      );
      const y = clamp(
        height * (edge[1] + (random() - 0.5) * 0.13),
        84,
        height - 12,
      );
      leaves.push(makeLeaf(x, y, (28 + random() * 16) * scale, i, air));
    }
    const now = performance.now() / 1000;
    nextBreeze = now + 7;
    clearUntil = cleared ? now + settings.refillDelay : now + .2;
    nextRefill = clearUntil;
    // Fresh pages share one gradual arrival; reduced-motion users get a still scene.
    if (cleared || !reduced.matches)
      leaves.forEach((l) => {
        l.alive = false;
        l.returnAt = clearUntil;
      });
  }
  function resize() {
    if (!pageActive || document.hidden || (generationPaused && isEmpty())) { releaseSurfaces(); return; }
    const w = page.clientWidth,
      h = page.clientHeight;
    if (!w || !h) { releaseSurfaces(); return; }
    const ratios = leafSurfaceRatios(w, h, devicePixelRatio, settings.maxPixelRatio);
    const ratio = ratios.foreground;
    if (w === width && h === height && dpr === ratio && sprites.length) return;
    const oldWidth = width, oldHeight = height;
    width = w;
    height = h;
    dpr = ratio;
    canopyDpr = ratios.canopy;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canopy.width = hasCanopy ? Math.max(1, Math.floor(w * canopyDpr)) : 1;
    canopy.height = hasCanopy ? Math.max(1, Math.floor(h * canopyDpr)) : 1;
    const now = performance.now() / 1000;
    if (suspendedAt !== null) {
      const elapsed = now - suspendedAt;
      for (const leaf of leaves) {
        if (leaf.arrival) leaf.arrival.started += elapsed;
        if (leaf.returnAt) leaf.returnAt += elapsed;
      }
      nextBreeze += elapsed;
      if (clearUntil) clearUntil += elapsed;
      if (nextRefill) nextRefill += elapsed;
      suspendedAt = null;
    }
    if (!leaves.length) seedLeaves(generationPaused || clearUntil > now);
    else if (oldWidth && oldHeight) {
      for (const leaf of leaves) {
        leaf.x *= w / oldWidth;
        leaf.y *= h / oldHeight;
        if (leaf.arrival) for (const point of [leaf.arrival.from, leaf.arrival.to]) {
          point.x *= w / oldWidth;
          point.y *= h / oldHeight;
        }
      }
    }
    if (!sprites.length) updatePalette();
    drawCanopy();
    render(performance.now() / 1000);
    start();
  }
  function respawn(leaf: Leaf) {
    const to = {
      x: 24 + random() * (width - 48),
      y: 110 + random() * Math.max(1, height - 155),
    };
    // Choose a nearby upwind origin instead of racing across the whole viewport.
    const from = { x: clamp(to.x - 40 - random() * 110, 12, width - 12), y: -70 };
    leaf.x = from.x;
    leaf.y = from.y;
    leaf.vx = 0;
    leaf.vy = 0;
    leaf.z = 0.8;
    leaf.vz = 0;
    leaf.spin = (random() - 0.5) * .7;
    leaf.alive = true;
    leaf.sweeping = false;
    leaf.returnAt = 0;
    leaf.angle = (random() - 0.5) * 5;
    leaf.arrival = {
      from,
      to,
      started: performance.now() / 1000,
      duration: (5 + (to.y - from.y) / 140 + random() * 2) / Math.max(0.4, settings.breezeSpeed),
    };
  }
  function update(dt: number, now: number) {
    if (!generationPaused && settings.breezeSpeed > 0 && now >= nextBreeze && now >= clearUntil) {
      nextBreeze = now + 7 + random() * 6;
      const resting = leaves.filter((l) => l.alive && l.z === 0);
      for (let n = 0; n < Math.min(2, resting.length); n++) {
        const l = resting[Math.floor(random() * resting.length)];
        l.z = 0.22;
        l.vz = 0.3;
        l.vx += (24 + random() * 22) * settings.breezeSpeed;
        l.vy += 7 + random() * 10;
        l.spin += (random() - 0.5) * 1.5;
      }
    }
    for (const l of leaves) {
      if (!l.alive) {
        if (!generationPaused && now >= l.returnAt && now >= clearUntil && now >= nextRefill) {
          respawn(l);
          nextRefill = now + Math.max(0.05, settings.refillInterval);
        }
        continue;
      }
      // Return gradually from the upwind edge, landing across the entire page.
      if (l.arrival) {
        const pose = fallPose(l.arrival, now, l.phase);
        l.x = pose.x;
        l.y = pose.y;
        l.z = pose.z;
        l.angle += l.spin * dt * pose.spin;
        if (pose.done) {
          l.arrival = undefined;
          l.z = 0;
          l.spin = 0;
        }
        continue;
      }
      if (l.sweeping) {
        l.vx = Math.max(l.vx, width * 0.65 + 180);
        l.z = Math.max(0.25, l.z - dt * 0.12);
        l.vy *= Math.exp(-0.2 * dt);
      } else if (l.z > 0 || l.vz > 0) {
        l.vz -= 0.42 * dt;
        l.z += l.vz * dt;
        const drag = Math.exp(-0.4 * dt);
        l.vx *= drag;
        l.vy *= drag;
        l.vx +=
          (7 + 5 * Math.sin(now * 0.55 + l.phase)) * dt * settings.breezeSpeed;
        l.vy += 5 * dt;
        l.spin *= Math.exp(-0.5 * dt);
        if (l.z < 0) {
          l.z = 0;
          l.vz = 0;
          l.vx *= 0.52;
          l.vy *= 0.52;
          l.spin *= 0.4;
        }
      } else {
        const friction = Math.exp(-3.3 * dt);
        l.vx *= friction;
        l.vy *= friction;
        l.spin *= Math.exp(-3 * dt);
        if (Math.abs(l.vx) < .05) l.vx = 0;
        if (Math.abs(l.vy) < .05) l.vy = 0;
        if (Math.abs(l.spin) < .002) l.spin = 0;
      }
      l.x += l.vx * dt;
      l.y += l.vy * dt;
      l.angle += l.spin * dt;
      if (l.x > width + 100 || l.x < -120 || l.y > height + 120 || l.y < -120) {
        l.alive = false;
        l.returnAt = Math.max(now + settings.refillDelay, clearUntil);
      }
    }
    gusts = gusts.filter((g) => now - g.time < 0.8);
  }
  function render(now: number) {
    if (!width || !sprites.length) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const dark = page.dataset.theme === "dark";
    order.length = 0;
    for (const leaf of leaves) if (leaf.alive) order.push(leaf);
    order.sort((a, b) => a.z - b.z);
    for (const l of order) {
      l.sx = 1 + Math.min(l.z, 1) * 0.055;
      l.sy =
        1 - Math.min(l.z, 1) * (0.16 + 0.2 * Math.sin(now * 2.7 + l.phase));
      l.viewAngle =
        l.angle + Math.min(l.z, 1) * Math.sin(now * 2 + l.phase) * 0.2;
      l.opacity = clamp((l.y - 45) / 40, 0, 1) * 0.96;
      ctx.save();
      ctx.translate(l.x + 2 + l.z * 11, l.y + 3 + l.z * 12);
      ctx.rotate(l.viewAngle);
      ctx.scale(l.sx, l.sy);
      ctx.globalAlpha =
        (dark ? 0.28 : 0.14) * (1 - clamp(l.z * 0.5, 0, 0.7)) * l.opacity;
      ctx.drawImage(
        sprites[l.sprite].shadow,
        -1.28 * l.size,
        -l.size,
        2.56 * l.size,
        2.56 * l.size,
      );
      ctx.restore();
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.viewAngle);
      ctx.scale(l.sx, l.sy);
      ctx.globalAlpha = l.opacity;
      ctx.drawImage(
        sprites[l.sprite].image,
        -1.28 * l.size,
        -l.size,
        2.56 * l.size,
        2.56 * l.size,
      );
      ctx.restore();
    }
    for (const g of gusts) {
      const progress = clamp((now - g.time) / 0.8, 0, 1);
      ctx.save();
      ctx.translate(g.x + progress * 55, g.y - progress * 15);
      ctx.strokeStyle = palette.wind;
      ctx.lineWidth = 1;
      ctx.globalAlpha = (1 - progress) * 0.24;
      for (let j = 0; j < 3; j++) {
        ctx.beginPath();
        ctx.ellipse(
          j * 10,
          -j * 9,
          18 + progress * (70 + j * 18),
          7 + progress * (26 + j * 8),
          -0.25,
          Math.PI * 0.95,
          Math.PI * 1.7,
        );
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  const moving = () => leaves.some(leaf => leaf.alive && (leaf.arrival || leaf.sweeping || leaf.z > 0 || leaf.vz > 0 || leaf.vx || leaf.vy || leaf.spin)) || gusts.length > 0;
  function schedule() {
    if (!pageActive || !sprites.length || !visible || document.hidden || !root.isConnected || reduced.matches) return;
    if (moving()) {
      if (!raf) raf = requestAnimationFrame(tick);
      return;
    }
    // Resting leaves need no redraw. Wake only for the next breeze or refill.
    lastTime = 0;
    let next = !generationPaused && settings.breezeSpeed > 0 && leaves.some(leaf => leaf.alive)
      ? Math.max(nextBreeze, clearUntil) : Infinity;
    if (!generationPaused) for (const leaf of leaves) {
      if (!leaf.alive) next = Math.min(next, Math.max(leaf.returnAt, clearUntil, nextRefill));
    }
    if (Number.isFinite(next) && !wakeTimer) wakeTimer = window.setTimeout(() => {
      wakeTimer = 0;
      tick(performance.now());
    }, Math.max(16, (next - performance.now() / 1000) * 1000));
  }
  function tick(nowMs: number) {
    raf = 0;
    if (!pageActive || !visible || document.hidden || !root.isConnected || !sprites.length) return;
    const interval = 1000 / Math.max(15, Math.min(60, settings.maxFps));
    if (lastTime && nowMs - lastTime < interval - .5) {
      raf = requestAnimationFrame(tick);
      return;
    }
    const dt = lastTime ? Math.min((nowMs - lastTime) / 1000, .05) : 1 / 60;
    lastTime = nowMs;
    if (!reduced.matches) update(dt, nowMs / 1000);
    render(nowMs / 1000);
    if (generationPaused && isEmpty()) releaseSurfaces();
    else schedule();
  }
  function start() {
    if (!sprites.length) return;
    clearTimeout(wakeTimer);
    wakeTimer = 0;
    schedule();
  }
  function hit(point: Point) {
    for (let i = order.length - 1; i >= 0; i--) {
      const l = order[i];
      if (!l.alive || l.opacity < 0.3) continue;
      const dx = point.x - l.x,
        dy = point.y - l.y,
        c = Math.cos(l.viewAngle),
        s = Math.sin(l.viewAngle),
        x = (dx * c + dy * s) / (l.size * l.sx),
        y = (-dx * s + dy * c) / (l.size * l.sy);
      if (hitCtx.isPointInPath(sprites[l.sprite].path, x, y)) return l;
    }
    return null;
  }
  function gust(point: Point, power = 1, notify = true) {
    if (!width) return;
    power *= settings.gustStrength;
    const radius =
        settings.clickRadius *
        (width < settings.mobileBreakpoint ? 0.66 : 1) *
        Math.max(0.7, power),
      now = performance.now() / 1000;
    for (const l of leaves) {
      if (!l.alive) continue;
      const dx = l.x - point.x,
        dy = l.y - point.y,
        distance = Math.hypot(dx, dy);
      if (distance > radius) continue;
      const falloff = Math.pow(1 - distance / radius, 1.1);
      l.arrival = undefined;
      if (reduced.matches) {
        l.alive = false;
        l.returnAt = now + settings.refillDelay;
        continue;
      }
      const d = Math.max(distance, 12);
      l.vx += ((dx / d) * 0.8 + 0.7) * 330 * falloff * power;
      l.vy += ((dy / d) * 0.65 - 0.5) * 260 * falloff * power;
      l.z = Math.max(l.z, 0.24 + 0.4 * falloff);
      l.vz = Math.max(l.vz, 0.65 + falloff * 0.32);
      l.spin += (random() - 0.5) * 5 * falloff;
    }
    if (!reduced.matches) gusts.push({ ...point, time: now });
    if (notify)
      root.dispatchEvent(
        new CustomEvent("ginkgo:gust", { detail: { cleared: false } }),
      );
    render(now);
    start();
  }
  function clearAll(notify = true) {
    if (!width) return;
    const now = performance.now() / 1000;
    clearUntil = now + settings.refillDelay;
    nextRefill = clearUntil;
    nextBreeze = clearUntil + 5;
    for (const l of leaves) {
      l.arrival = undefined;
      if (!l.alive) {
        l.returnAt = clearUntil;
        continue;
      }
      if (reduced.matches) {
        l.alive = false;
        l.returnAt = clearUntil;
        continue;
      }
      l.sweeping = true;
      l.vx = 370 + random() * 180;
      l.vy = -100 - random() * 170;
      l.z = 0.45 + random() * 0.45;
      l.vz = 0.55 + random() * 0.3;
      l.spin = (random() - 0.5) * 5;
    }
    if (!reduced.matches)
      gusts.push({ x: width * 0.3, y: height * 0.65, time: now });
    if (notify)
      root.dispatchEvent(
        new CustomEvent("ginkgo:gust", { detail: { cleared: true } }),
      );
    render(now);
    if (generationPaused && isEmpty()) releaseSurfaces();
    else start();
  }
  function stopPointer(e: PointerEvent) {
    if (!blocked || blocked.id !== e.pointerId) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    suppressClick = { ...blocked, until: performance.now() + 600 };
    blocked = null;
    if (eventTarget.hasPointerCapture?.(e.pointerId))
      eventTarget.releasePointerCapture(e.pointerId);
  }
  eventTarget.addEventListener(
    "pointerdown",
    (e) => {
      if (
        e.button !== 0 ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey ||
        ignoresPointer(e)
      )
        return;
      suppressClick = null;
      const p = surfacePoint(e),
        leaf = hit(p);
      if (leaf) {
        blocked = { id: e.pointerId, x: e.clientX, y: e.clientY };
        gust(p);
        e.preventDefault();
        e.stopImmediatePropagation();
        eventTarget.setPointerCapture(e.pointerId);
      } else if (!(e.target as Element).closest(cardSelector))
        gust(p, 0.9, true);
    },
    { capture: true },
  );
  eventTarget.addEventListener("pointerup", stopPointer, { capture: true });
  eventTarget.addEventListener(
    "pointercancel",
    (e) => {
      if (blocked?.id === e.pointerId) {
        suppressClick = null;
        blocked = null;
      }
    },
    { capture: true },
  );
  eventTarget.addEventListener(
    "click",
    (e) => {
      if (
        e.detail &&
        suppressClick &&
        performance.now() < suppressClick.until &&
        Math.hypot(e.clientX - suppressClick.x, e.clientY - suppressClick.y) <
          45
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        suppressClick = null;
      }
    },
    { capture: true },
  );
  eventTarget.addEventListener(
    "pointermove",
    (e) => {
      if (
        reduced.matches ||
        ignoresPointer(e)
      )
        return;
      const now = performance.now(),
        p = surfacePoint(e);
      if (blocked?.id === e.pointerId) {
        if (now - lastBrush > 90) {
          gust(p, 0.6, false);
          lastBrush = now;
        }
        e.stopImmediatePropagation();
        return;
      }
      if (
        e.pointerType === "touch" ||
        e.buttons ||
        root.querySelector(".qp-dragging")
      )
        return;
      if (lastPointer && now - lastPointer.t > 0 && now - lastPointer.t < 140) {
        const speed = Math.min(
          1100,
          (Math.hypot(p.x - lastPointer.x, p.y - lastPointer.y) /
            (now - lastPointer.t)) *
            1000,
        );
        if (speed > 50)
          for (const l of leaves) {
            const dx = l.x - p.x,
              dy = l.y - p.y,
              d = Math.hypot(dx, dy);
            if (!l.alive || d > settings.pointerRadius) continue;
            l.arrival = undefined;
            const force =
              (1 - d / settings.pointerRadius) * Math.min(20, speed * 0.025);
            l.vx += (dx / Math.max(d, 12) + 0.35) * force;
            l.vy += (dy / Math.max(d, 12) - 0.15) * force;
            l.z = Math.max(l.z, 0.035);
            l.vz = Math.max(l.vz, 0.15);
            l.spin += (random() - 0.5) * 0.12;
          }
      }
      lastPointer = { ...p, t: now };
      start();
    },
    { capture: true },
  );
  eventTarget.addEventListener("pointerleave", () => {
    lastPointer = null;
  });
  bindWindControl(windButton, {
    clear: () => clearAll(),
    pausedChanged(paused) {
      generationPaused = paused;
      if (paused) clearAll(false);
      else {
        suspendedAt = null;
        clearUntil = 0;
        nextRefill = 0;
        nextBreeze = performance.now() / 1000 + 7;
        resize();
        if (reduced.matches && width) seedLeaves(false);
        render(performance.now() / 1000);
        start();
      }
      const status = root.querySelector<HTMLElement>(".qp-announcement, #announcement");
      if (status) status.textContent = paused
        ? "银杏叶生成已暂停。再次长按吹风按钮可恢复。"
        : "银杏叶生成已恢复。";
    },
  }, interaction.windControl);
  new MutationObserver((records) => {
    if (records.some((r) => r.attributeName === "data-theme")) updatePalette();
    const entering = page.classList.contains("qp-entering");
    // Navigation hides the layer through CSS; preserve leaves for history return.
    windButton.disabled = entering;
  }).observe(page, {
    attributes: true,
    attributeFilter: ["data-theme", "class"],
  });
  new ResizeObserver(resize).observe(page);
  new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      if (visible) { resize(); start(); }
      else {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        lastTime = 0;
        clearTimeout(wakeTimer);
        wakeTimer = 0;
      }
    },
    { threshold: 0.01 },
  ).observe(page);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) releaseSurfaces();
    else { resize(); start(); }
  });
  window.addEventListener("pagehide", () => { pageActive = false; releaseSurfaces(); });
  window.addEventListener("pageshow", () => { pageActive = true; resize(); start(); });
  reduced.addEventListener("change", () => {
    if (reduced.matches) {
      leaves.forEach((l) => {
        if (generationPaused) l.alive = false;
        l.arrival = undefined;
        l.vx = 0;
        l.vy = 0;
        l.z = 0;
        l.vz = 0;
        l.spin = 0;
      });
      gusts = [];
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      clearTimeout(wakeTimer);
      wakeTimer = 0;
    }
    render(performance.now() / 1000);
    start();
  });
  resize();
  start();
}
