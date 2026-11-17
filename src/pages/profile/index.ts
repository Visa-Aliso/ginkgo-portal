import { initPageLifecycle } from "../../shared/page-lifecycle";
import { ArrowUpLeft, ArrowUpRight, BookOpen, CodeXml, Mail, Globe, FileText, Sun, Moon, Monitor, Wind, Feather, createIcons } from "../../shared/icons";
import { required } from "../../shared/dom";
import { siteConfig } from "../../config/site";
import { initBrand } from "../../shared/brand";
import { profile } from "../../config/profile";
import { renderProfile } from "./render";
import { initTheme } from "../../shared/theme";
import { initLeaves } from "../../effects/leaves";
import { enterPage } from "../../shared/page-transition";

const root = required(document, "#ginkgo-profile");
initPageLifecycle(root);
initBrand(root);
renderProfile(root, profile, siteConfig.motion);
createIcons({ icons: { ArrowUpLeft, ArrowUpRight, BookOpen, CodeXml, Mail, Globe, FileText, Sun, Moon, Monitor, Wind, Feather }, attrs: { "stroke-width": 1.4, "aria-hidden": "true" } });
initTheme(root, { defaultTheme: siteConfig.defaultTheme });
initLeaves(root, { ...siteConfig.leaves, ...profile.leaves }, {
  canopy: false,
  target: root, cardSelector: ".profile-document",
  windControl: { initialPaused: profile.leavesPaused, persist: false },
  ignoreSelector: ".site-header, a, button",
});
root.addEventListener("ginkgo:gust", () => { required(root, "#announcement").textContent = "风吹过，银杏叶轻轻散开。"; });

void enterPage(root, "profile", siteConfig.motion).catch(error => console.warn("Profile arrival animation skipped:", error)).then(() => {
  try {
    if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ behavior: "instant" });
  } catch { /* Malformed fragment must not interrupt the page. */ }
});
