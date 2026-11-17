export type ThemePreference = "light" | "dark" | "system";
export type EntryId = "blog" | "profile" | "notes";

export interface EntryConfig {
  label: string;
  caption: string;
  /** HTTP(S) URL or relative page path. Leave empty to preview the animation. */
  url: string;
}

export interface LeafConfig {
  enabled: boolean;
  desktopCount: number;
  mobileCount: number;
  mobileBreakpoint: number;
  /** Leaf size multiplier. */
  size: number;
  /** Delay before replenishing cleared leaves, in seconds. */
  refillDelay: number;
  /** Interval between returning leaves, in seconds. Lower values refill faster. */
  refillInterval: number;
  /** Natural wind strength; does not affect gravity or spring timing. */
  breezeSpeed: number;
  gustStrength: number;
  pointerRadius: number;
  clickRadius: number;
  /** Rendering limits that reduce power consumption on mobile devices. */
  maxFps: number;
  maxPixelRatio: number;
}

export interface SiteConfig {
  name: string;
  defaultTheme: ThemePreference;
  entries: Record<EntryId, EntryConfig>;
  motion: {
    responsiveMotion: boolean;
    softness: number;
    breeze: boolean;
    transitionSpeed: number;
  };
  leaves: LeafConfig;
}

/** Central configuration for everyday changes. No server or database required. */
export const siteConfig: SiteConfig = {
  name: "",
  defaultTheme: "system",
  entries: {
    blog: { label: "Blog", caption: "文章与记录", url: "" },
    profile: { label: "Profile", caption: "关于我", url: "" },
    notes: { label: "Notes", caption: "一些随想", url: "./notes.html" },
  },
  motion: {
    responsiveMotion: true,
    softness: 1.1,
    breeze: true,
    // 1 preserves the current timing; 1.25 is faster and 0.8 is slower.
    transitionSpeed: 1,
  },
  leaves: {
    enabled: true,
    desktopCount: 40,
    mobileCount: 26,
    mobileBreakpoint: 600,
    size: 1,
    refillDelay: 4,
    refillInterval: 0.32,
    breezeSpeed: 1,
    gustStrength: 1,
    pointerRadius: 90,
    clickRadius: 225,
    maxFps: 45,
    maxPixelRatio: 2,
  },
};
