import { required, element, icon } from "../../shared/dom";
import type { ProfileConfig, ProfileItem, ProfileLink, SiteConfig } from "../../config/types";
import { markdownToHtml } from "../../shared/markdown";
import { bindSectionDisclosure } from "./section-motion";

function safeUrl(value: string, image = false): string | null {
  try {
    const url = new URL(value, document.baseURI);
    return value.trim() && (image ? ["https:", "http:"] : ["https:", "http:", "mailto:"]).includes(url.protocol) ? url.href : null;
  } catch { return null; }
}
function link(data: ProfileLink, className = "") {
  const href = safeUrl(data.url);
  if (!href) return element("span", className, data.name);
  const node = element("a", className);
  node.href = href;
  if (new URL(href).origin !== location.origin && !href.startsWith("mailto:")) {
    node.target = "_blank";
    node.rel = "noopener noreferrer";
  }
  if (data.icon) node.append(icon(data.icon === "github" ? "code-xml" : data.icon));
  node.append(element("span", "", data.name));
  node.append(icon("arrow-up-right"));
  return node;
}
function markdown(className: string, text: string) {
  const node = element("div", className);
  node.innerHTML = markdownToHtml(text);
  return node;
}
function record(item: ProfileItem, kind: string, index: number) {
  const row = element("article", `profile-record record-${kind}${item.year || item.years ? " record-dated" : ""}`);
  const meta = element("div", "record-meta", item.years || item.year || String(index + 1).padStart(2, "0"));
  const body = element("div", "record-body");
  const title = item.school || item.title || "";
  const heading = element("h3", "record-title");
  heading.append(item.schoolUrl || item.url ? link({ name: title, url: item.schoolUrl || item.url! }) : document.createTextNode(title));
  if (item.logo && safeUrl(item.logo, true)) {
    const image = element("img", "record-logo");
    image.src = safeUrl(item.logo, true)!;
    image.alt = "";
    image.loading = "lazy";
    image.addEventListener("error", () => image.remove(), { once: true });
    body.append(image);
  }
  body.append(heading);
  for (const value of [item.dept, item.degree, item.authors]) if (value) body.append(markdown("record-detail", value));
  const labels = [item.type, item.venue, item.organization].filter(Boolean);
  if (labels.length) body.append(element("p", "record-labels", labels.join(" / ")));
  if (item.description) body.append(markdown("record-description", item.description));
  if (item.links?.length) {
    const links = element("div", "record-links");
    for (const value of item.links) links.append(link(value));
    body.append(links);
  }
  if (item.award) body.append(element("p", "record-award", item.award));
  row.append(meta, body);
  return row;
}

export function renderProfile(root: HTMLElement, profile: ProfileConfig, motion: SiteConfig["motion"]) {
  required(root, "#profile-name").textContent = profile.name;
  required(root, ".profile-avatar-placeholder").textContent = profile.name.slice(0, 1).toLowerCase() + ".";
  required(root, "#profile-copyright").textContent = `© ${new Date().getFullYear()} ${profile.name}`;
  required(root, "#profile-role").textContent = profile.title;
  const affiliation = required(root, "#profile-affiliation");
  affiliation.textContent = profile.affiliation;
  affiliation.hidden = !profile.affiliation;
  required(root, "#profile-bio").innerHTML = markdownToHtml(profile.bio);
  const social = required(root, "#profile-links");
  social.hidden = profile.links.length === 0;
  for (const value of profile.links) social.append(link(value));
  document.title = `${profile.name} · Profile · 银杏与风`;
  if (profile.avatar && safeUrl(profile.avatar, true)) {
    const image = element("img", "profile-avatar");
    image.alt = `${profile.name} 的头像`;
    image.addEventListener("load", () => { root.querySelector(".profile-avatar-placeholder")?.replaceWith(image); }, { once: true });
    image.src = safeUrl(profile.avatar, true)!;
  }
  const sections = profile.sections.filter(section => section.visible);
  for (const section of sections) {
    const node = element("section", "profile-section");
    node.id = section.id;
    node.setAttribute("aria-labelledby", `${section.id}-title`);
    const heading = element("div", "section-heading");

    const title = element("h2", "", section.title);
    title.id = `${section.id}-title`;
    heading.append(title, element("span", "section-english", section.english));
    node.append(heading);
    const items = element("div", "profile-records");
    items.id = `${section.id}-records`;
    const count = Math.max(1, section.initialShow);
    const rows = section.items.map((item, i) => record(item, section.id, i));
    rows.forEach((row, i) => { row.hidden = i >= count; items.append(row); });
    if (!rows.length) {
      const empty = element("div", "profile-empty");
      empty.append(element("p", "", section.empty));
      items.append(empty);
    }
    node.append(items);
    if (rows.length > count) {
      const button = element("button", "profile-more", `展开全部 (${rows.length}) +`);
      button.type = "button";
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-controls", items.id);
      bindSectionDisclosure(items, rows, button, count, motion);
      node.append(button);
    }
    required(root, "#profile-sections").append(node);

  }
}
