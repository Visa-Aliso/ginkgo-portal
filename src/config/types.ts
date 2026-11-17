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
  /** Maximum foreground canvas pixels. Lower values trade leaf sharpness for memory. */
  pixelBudget: number;
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


/** Academic profile content configuration. Empty records never imply credentials.
 * Set visible: false to hide a section; initialShow controls its disclosure.
 * See docs/profile.md for examples of every supported record type.
 */
export interface ProfileLink { name: string; url: string; icon?: string }
export interface ProfileItem {
  title?: string; description?: string; url?: string;
  years?: string; school?: string; schoolUrl?: string; dept?: string; degree?: string; logo?: string;
  authors?: string; venue?: string; type?: string; links?: ProfileLink[]; award?: string;
  organization?: string; year?: string;
}
export interface ProfileSection {
  id: string; title: string; english: string; visible: boolean;
  initialShow: number; empty: string; items: ProfileItem[];
}

export interface PageLeaves { desktopCount: number; mobileCount: number; size: number; }
export interface ProfileConfig { name: string; title: string; affiliation: string; avatar: string; bio: string; links: ProfileLink[]; sections: ProfileSection[]; leaves: PageLeaves; leavesPaused: boolean; }
export interface NotesConfig { title: string; subtitle: string; collectionLabel: string; footer: string; leaves: PageLeaves; }
