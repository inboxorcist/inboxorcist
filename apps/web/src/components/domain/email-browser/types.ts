import type { ExplorerFilters } from "@/lib/api";

export interface EmailBrowserConfig {
  mode: "explore" | "cleanup";
  pageSize: number;
}

export interface FilterPreset {
  id: string;
  label: string;
  filters: ExplorerFilters;
}

export type CleanupCategory =
  | "promotions"
  | "social"
  | "updates"
  | "forums"
  | "old_1year"
  | "old_2years"
  | "large_5mb"
  | "large_10mb";

// Filter presets for cleanup categories
export const CLEANUP_PRESETS: Record<CleanupCategory, ExplorerFilters> = {
  promotions: { category: "CATEGORY_PROMOTIONS", isTrash: false, isSpam: false },
  social: { category: "CATEGORY_SOCIAL", isTrash: false, isSpam: false },
  updates: { category: "CATEGORY_UPDATES", isTrash: false, isSpam: false },
  forums: { category: "CATEGORY_FORUMS", isTrash: false, isSpam: false },
  old_2years: {
    dateTo: Date.now() - 2 * 365 * 24 * 60 * 60 * 1000,
    isTrash: false,
    isSpam: false,
  },
  old_1year: {
    dateTo: Date.now() - 365 * 24 * 60 * 60 * 1000,
    isTrash: false,
    isSpam: false,
  },
  large_10mb: { sizeMin: 10 * 1024 * 1024, isTrash: false, isSpam: false },
  large_5mb: { sizeMin: 5 * 1024 * 1024, isTrash: false, isSpam: false },
};
