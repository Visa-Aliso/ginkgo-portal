import data from "../../config/profile.config?data";
import type { ProfileConfig } from "./types";
export type { ProfileItem, ProfileLink, ProfileSection } from "./types";
export const profile = data as ProfileConfig;
