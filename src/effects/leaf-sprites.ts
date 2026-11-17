import { seededRandom } from "./random.ts";

export interface LeafSprite {
  image: HTMLCanvasElement;
  shadow: HTMLCanvasElement;
  path: Path2D;
}
function rim(theta: number, seed: number) {
  const notch = 0.13 * Math.exp(-Math.pow((theta - 0.04) / 0.13, 2));
  const radius =
    0.91 -
    notch +
    0.022 * Math.sin(theta * 10 + seed) +
    0.009 * Math.sin(theta * 31 + seed * 2);
  return { x: Math.sin(theta) * radius, y: 0.31 - Math.cos(theta) * radius };
}
function leafPath(seed: number) {
  const p = new Path2D(),
    first = rim(-1.18, seed);
  p.moveTo(0, 0.33);
  p.quadraticCurveTo(-0.3, 0.15, first.x, first.y);
  for (let j = 1; j <= 90; j++) {
    const v = rim(-1.18 + (j / 90) * 2.36, seed);
    p.lineTo(v.x, v.y);
  }
  p.quadraticCurveTo(0.3, 0.16, 0, 0.33);
  p.closePath();
  return p;
}
export function makeLeafSprite(index: number, palette: Record<string, string>): LeafSprite {
  const seed = index * 0.83 + 0.21,
    path = leafPath(seed),
    image = document.createElement("canvas"),
    shadow = document.createElement("canvas");
  image.width = image.height = shadow.width = shadow.height = 128;
  const c = image.getContext("2d")!,
    s = shadow.getContext("2d")!,
    localRandom = seededRandom(7823 + index * 431);
  c.scale(.5, .5);
  c.translate(128, 100);
  c.scale(100, 100);
  const base = [
    palette.gold,
    palette.amber,
    palette.olive,
    palette.gold,
    palette.olive,
    palette.amber,
  ][index];
  const fill = c.createLinearGradient(-0.65, -0.55, 0.45, 0.45);
  fill.addColorStop(0, palette.highlight);
  fill.addColorStop(0.3, base);
  fill.addColorStop(0.78, base);
  fill.addColorStop(1, palette.shade);
  c.fillStyle = fill;
  c.fill(path);
  c.save();
  c.clip(path);
  for (let n = 0; n < 26; n++) {
    c.globalAlpha = 0.025 + localRandom() * 0.035;
    c.fillStyle = n % 2 ? palette.highlight : palette.shade;
    c.beginPath();
    c.ellipse(
      (localRandom() - 0.5) * 1.5,
      localRandom() * 0.7 - 0.5,
      0.06 + localRandom() * 0.15,
      0.02 + localRandom() * 0.06,
      localRandom() * 2,
      0,
      Math.PI * 2,
    );
    c.fill();
  }
  c.strokeStyle = palette.vein;
  c.lineWidth = 0.006;
  c.globalAlpha = 0.47;
  c.lineCap = "round";
  for (let j = 0; j < 23; j++) {
    const theta = -1.12 + (j / 22) * 2.24,
      end = rim(theta, seed);
    end.x *= 0.985;
    end.y = 0.31 + (end.y - 0.31) * 0.985;
    const mid = { x: end.x * 0.45, y: 0.33 + (end.y - 0.33) * 0.45 };
    c.beginPath();
    c.moveTo(0, 0.32);
    c.quadraticCurveTo(end.x * 0.2, 0.1, end.x, end.y);
    c.stroke();
    const branch = rim(theta + (j % 2 ? 0.038 : -0.038), seed);
    c.globalAlpha = 0.27;
    c.beginPath();
    c.moveTo(mid.x, mid.y);
    c.quadraticCurveTo(
      end.x * 0.74,
      mid.y + (end.y - mid.y) * 0.5,
      branch.x * 0.99,
      branch.y,
    );
    c.stroke();
    c.globalAlpha = 0.47;
  }
  c.restore();
  c.globalAlpha = 0.25;
  c.lineWidth = 0.009;
  c.strokeStyle = palette.shade;
  c.stroke(path);
  c.globalAlpha = 0.85;
  c.lineWidth = 0.018;
  c.lineCap = "round";
  c.strokeStyle = palette.stem;
  c.beginPath();
  c.moveTo(0, 0.29);
  c.bezierCurveTo(0.015, 0.47, 0.045, 0.66, 0.11, 0.79);
  c.stroke();
  c.globalAlpha = 0.55;
  c.lineWidth = 0.006;
  c.strokeStyle = palette.vein;
  c.beginPath();
  c.moveTo(-0.008, 0.29);
  c.quadraticCurveTo(0.005, 0.55, 0.1, 0.76);
  c.stroke();
  s.filter = "blur(2px)";
  s.scale(.5, .5);
  s.translate(128, 100);
  s.scale(100, 100);
  s.fillStyle = "#000";
  s.fill(path);
  s.strokeStyle = "#000";
  s.lineWidth = 0.02;
  s.beginPath();
  s.moveTo(0, 0.3);
  s.quadraticCurveTo(0.01, 0.57, 0.11, 0.79);
  s.stroke();
  return { image, shadow, path };
}

/** Release backing bitmaps before dropping references, including theme changes. */
export function releaseLeafSprites(sprites: LeafSprite[]) {
  for (const sprite of sprites) {
    sprite.image.width = sprite.image.height = sprite.shadow.width = sprite.shadow.height = 1;
  }
  sprites.length = 0;
}
