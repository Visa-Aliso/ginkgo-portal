import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { parseSiteConfig, parseProfileConfig, parseNotesConfig } from "../src/config/parse.ts";

const read = (path: string) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** Render first-paint settings into HTML; visitors never wait for a config fetch. */
export function configPlugin(): Plugin {
  return {
    name: "ginkgo-config",
    enforce: "pre",
    load(id) {
      if (!id.endsWith(".config?data")) return;
      const file = id.slice(0, -5);
      this.addWatchFile(file);
      const raw = readFileSync(file, "utf8");
      const parse = file.endsWith("/site.config") ? parseSiteConfig : file.endsWith("/profile.config") ? parseProfileConfig : file.endsWith("/notes.config") ? parseNotesConfig : null;
      if (!parse) throw new Error(`Unsupported config: ${file}`);
      // Compile a plain object; no JSON source strings or validation code in the browser.
      return `export default ${JSON.stringify(parse(raw))};`;
    },
    transformIndexHtml: {
      order: "pre",
      handler(html, context) {
        const site = parseSiteConfig(read("config/site.config"));
        const profile = parseProfileConfig(read("config/profile.config"));
        const notes = parseNotesConfig(read("config/notes.config"));
        const page = context.filename.endsWith("profile.html") ? "profile" : context.filename.endsWith("notes.html") ? "notes" : "portal";
        const settings = JSON.stringify({ page, defaultTheme: site.defaultTheme, responsiveMotion: site.motion.responsiveMotion });
        const boot = read("src/shared/bootstrap.js").replace("export function", "function");
        html = html.replace("<!-- site:bootstrap -->", `<script>${boot}\nbootstrapPage(${settings});</script>`);
        const name = escape(site.name.trim() || "Ginkgo");
        html = html.replace(/(<(?:a|span)\b[^>]*data-site-name[^>]*>)[^<]*(<\/[^>]+>)/g, (_match, open, close) => `${open}${name}${close}`);
        html = html.replace(/aria-label="Ginkgo，返回引导页"/g, () => `aria-label="${name}，返回引导页"`);
        if (page === "profile") {
          html = html.replace(/(<h1 id="profile-name">)[^<]*/, (_match, open) => `${open}${escape(profile.name)}`);
          html = html.replace(/(<div class="profile-avatar-placeholder"[^>]*>)[^<]*/, (_match, open) => `${open}${escape(profile.name.slice(0, 1).toLowerCase())}.`);
          const label = profile.leavesPaused ? "银杏叶已暂停；单击吹风，长按恢复生成" : "单击吹开银杏叶，长按暂停生成";
          html = html.replace(/(<button class="icon-button qp-wind-button")[^>]*>/, (_match, open) => `${open} aria-label="${label}" title="${label}" aria-pressed="${profile.leavesPaused}" data-leaves-paused="${profile.leavesPaused}">`);
        }
        if (page === "notes") {
          html = html.replace(/(<p class="intro-subtitle">)[^<]*/, (_match, open) => `${open}${escape(notes.subtitle)}`);
          html = html.replace(/(<div class="collection-end"><span><\/span><p>)[^<]*/, (_match, open) => `${open}${escape(notes.footer)}`);
        }
        const title = page === "profile" ? `${profile.name} · Profile · 银杏与风` : page === "notes" ? notes.title : `${site.name.trim() || "Ginkgo"} · 银杏与风`;
        return html.replace(/<title>[^<]*<\/title>/, () => `<title>${escape(title)}</title>`);
      },
    },
    handleHotUpdate(context) {
      if (context.file.endsWith(".config") || context.file.endsWith("/shared/bootstrap.js")) {
        for (const module of context.modules) context.server.moduleGraph.invalidateModule(module);
        context.server.ws.send({ type: "full-reload" });
        return [];
      }
    },
    configureServer(server) {
      server.watcher.add(fileURLToPath(new URL("../src/shared/bootstrap.js", import.meta.url)));
    },
  };
}
