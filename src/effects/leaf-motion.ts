/** Keep decorative bitmap allocations bounded, including on 4K / high-DPI screens. */
export function leafSurfaceRatios(width: number, height: number, deviceRatio: number, limit: number, budget = 2_097_152) {
  const area = Math.max(1, width * height);
  const foreground = Math.min(deviceRatio || 1, limit, Math.sqrt(budget / area));
  const canopy = Math.min(foreground, .5, Math.sqrt(262_144 / area));
  return { foreground, canopy };
}

export interface Fall {
  from: { x: number; y: number };
  to: { x: number; y: number };
  started: number;
  duration: number;
}

/** A continuous descent with a soft landing; sideways flutter dies out on contact. */
export function fallPose(fall: Fall, now: number, phase: number) {
  const t = Math.max(0, Math.min(1, (now - fall.started) / fall.duration));
  const progress = t * t * (3 - 2 * t);
  const sway = Math.sin(Math.PI * t) ** 2;
  return {
    x: fall.from.x + (fall.to.x - fall.from.x) * progress + Math.sin((now - fall.started) * 1.65 + phase) * 24 * sway,
    y: fall.from.y + (fall.to.y - fall.from.y) * progress,
    z: .8 * (1 - progress),
    spin: 1 - progress,
    done: t === 1,
  };
}
