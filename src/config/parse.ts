import type { SiteConfig, ProfileConfig, NotesConfig } from "./types.ts";

type ObjectValue = Record<string, unknown>;
const fail = (path: string, message: string): never => { throw new Error(`${path}: ${message}`); };
function object(value: unknown, path: string): ObjectValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "应为 JSON 对象");
  return value as ObjectValue;
}
function parse(raw: string, file: string) {
  try { return object(JSON.parse(raw), file); }
  catch (error) { return fail(file, `配置读取失败，${error instanceof Error ? error.message : String(error)}`); }
}
function text(value: unknown, path: string, nonempty = false): asserts value is string {
  if (typeof value !== "string" || (nonempty && !value.trim())) fail(path, nonempty ? "应为非空字符串" : "应为字符串");
}
function bool(value: unknown, path: string) {
  if (typeof value !== "boolean") fail(path, "应为 true 或 false");
}
function number(value: unknown, path: string, min: number, max: number, integer = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) fail(path, `应为 ${min}–${max} 范围内的${integer ? "整数" : "数字"}`);
}
function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, "应为数组");
  return value as unknown[];
}
function url(value: unknown, path: string, image = false) {
  text(value, path);
  if (!value) return;
  if (value !== value.trim() || /[\u0000-\u001f]/.test(value)) fail(path, "网址不能包含控制字符或首尾空格");
  try {
    const protocol = new URL(value, "https://site.invalid/").protocol;
    if (!(image ? ["https:", "http:"] : ["https:", "http:", "mailto:"]).includes(protocol)) fail(path, "网址协议不受支持");
  } catch { fail(path, "请填写有效的相对路径或 HTTP(S) / mailto 地址"); }
}
function keys(value: ObjectValue, allowed: string[], path: string) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${path}.${key}`, "未知配置项，请检查拼写");
}
function pageLeaves(value: unknown, path: string) {
  const data = object(value, path);
  keys(data, ["desktopCount", "mobileCount", "size"], path);
  for (const key of ["desktopCount", "mobileCount"]) number(data[key], `${path}.${key}`, 0, 120, true);
  number(data.size, `${path}.size`, .1, 3);
}
function links(value: unknown, path: string) {
  array(value, path).forEach((entry, i) => {
    const at = `${path}[${i}]`, data = object(entry, at);
    keys(data, ["name", "url", "icon"], at);
    text(data.name, `${at}.name`, true);
    url(data.url, `${at}.url`);
    if (data.icon !== undefined) {
      text(data.icon, `${at}.icon`);
      if (!["", "github", "book-open", "mail", "globe", "file-text"].includes(data.icon)) fail(`${at}.icon`, "不支持的图标名称");
    }
  });
}
export function parseSiteConfig(raw: string): SiteConfig {
  const file = "config/site.config", data = parse(raw, file);
  keys(data, ["name", "defaultTheme", "entries", "motion", "leaves"], file);
  text(data.name, `${file}.name`);
  if (!["light", "dark", "system"].includes(String(data.defaultTheme))) fail(`${file}.defaultTheme`, "应为 light、dark 或 system");
  const entries = object(data.entries, `${file}.entries`);
  keys(entries, ["blog", "profile", "notes"], `${file}.entries`);
  for (const id of ["blog", "profile", "notes"]) {
    const path = `${file}.entries.${id}`, entry = object(entries[id], path);
    keys(entry, ["label", "caption", "url"], path);
    text(entry.label, `${path}.label`, true); text(entry.caption, `${path}.caption`); url(entry.url, `${path}.url`, true);
  }
  const motion = object(data.motion, `${file}.motion`);
  keys(motion, ["responsiveMotion", "softness", "breeze", "transitionSpeed"], `${file}.motion`);
  bool(motion.responsiveMotion, `${file}.motion.responsiveMotion`); bool(motion.breeze, `${file}.motion.breeze`);
  number(motion.softness, `${file}.motion.softness`, .1, 5);
  number(motion.transitionSpeed, `${file}.motion.transitionSpeed`, .2, 3);
  const leaves = object(data.leaves, `${file}.leaves`);
  bool(leaves.enabled, `${file}.leaves.enabled`);
  const ranges: Record<string, [number, number, boolean?]> = {
    desktopCount: [0, 120, true], mobileCount: [0, 120, true], mobileBreakpoint: [320, 2000], size: [.1, 3],
    refillDelay: [0, 120], refillInterval: [.05, 60], breezeSpeed: [0, 5], gustStrength: [0, 5],
    pointerRadius: [0, 600], clickRadius: [0, 1000], maxFps: [15, 60], maxPixelRatio: [.5, 3],
    pixelBudget: [262_144, 4_194_304, true],
  };
  keys(leaves, ["enabled", ...Object.keys(ranges)], `${file}.leaves`);
  for (const [key, range] of Object.entries(ranges)) number(leaves[key], `${file}.leaves.${key}`, ...range);
  return data as unknown as SiteConfig;
}
export function parseProfileConfig(raw: string): ProfileConfig {
  const file = "config/profile.config", data = parse(raw, file);
  keys(data, ["name", "title", "affiliation", "avatar", "bio", "links", "sections", "leaves", "leavesPaused"], file);
  text(data.name, `${file}.name`, true);
  for (const key of ["title", "affiliation", "bio"]) text(data[key], `${file}.${key}`);
  url(data.avatar, `${file}.avatar`, true); links(data.links, `${file}.links`);
  pageLeaves(data.leaves, `${file}.leaves`); bool(data.leavesPaused, `${file}.leavesPaused`);
  const ids = new Set<string>();
  array(data.sections, `${file}.sections`).forEach((entry, i) => {
    const path = `${file}.sections[${i}]`, section = object(entry, path);
    keys(section, ["id", "title", "english", "visible", "initialShow", "empty", "items"], path);
    text(section.id, `${path}.id`, true);
    if (!["education", "publications", "opensource", "awards", "projects"].includes(section.id) || ids.has(section.id)) fail(`${path}.id`, "请使用不重复的标准栏目 ID");
    ids.add(section.id);
    for (const key of ["title", "english", "empty"]) text(section[key], `${path}.${key}`);
    bool(section.visible, `${path}.visible`); number(section.initialShow, `${path}.initialShow`, 1, 1000, true);
    array(section.items, `${path}.items`).forEach((entry, j) => {
      const at = `${path}.items[${j}]`, item = object(entry, at);
      const strings = ["title", "description", "years", "school", "dept", "degree", "authors", "venue", "type", "award", "organization", "year"];
      keys(item, [...strings, "url", "schoolUrl", "logo", "links"], at);
      for (const key of strings) if (item[key] !== undefined) text(item[key], `${at}.${key}`);
      if (!(typeof item.title === "string" && item.title.trim()) && !(typeof item.school === "string" && item.school.trim())) fail(at, "请填写 title 或 school");
      for (const key of ["url", "schoolUrl", "logo"]) if (item[key] !== undefined) url(item[key], `${at}.${key}`, key === "logo");
      if (item.links !== undefined) links(item.links, `${at}.links`);
    });
  });
  return data as unknown as ProfileConfig;
}
export function parseNotesConfig(raw: string): NotesConfig {
  const file = "config/notes.config", data = parse(raw, file);
  keys(data, ["title", "subtitle", "collectionLabel", "footer", "leaves"], file);
  for (const key of ["title", "subtitle", "collectionLabel", "footer"]) text(data[key], `${file}.${key}`, true);
  pageLeaves(data.leaves, `${file}.leaves`);
  return data as unknown as NotesConfig;
}
