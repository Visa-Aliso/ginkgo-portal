import data from "../../config/site.config?data";
import type { SiteConfig } from "./types";
export type { SiteConfig, LeafConfig, EntryId, ThemePreference } from "./types";
export const siteConfig = data as SiteConfig;
