import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tag,
  Users,
  Bell,
  MessageSquare,
  Calendar,
  HardDrive,
  Clock,
  Archive,
  Flame,
  Trash2,
} from "lucide-react";
import type { QuickStats, SyncProgress } from "@/lib/api";
import type { TranslationKey } from "@/lib/i18n";
import { useLanguage } from "@/hooks/useLanguage";
import { ExorcismCard, type ExorcismCardColor } from "./ExorcismCard";
import { getCleanupPresetFilters, buildFilteredUrl } from "@/lib/filter-url";

type CleanupCategory =
  | "promotions"
  | "social"
  | "updates"
  | "forums"
  | "old_1year"
  | "old_2years"
  | "large_5mb"
  | "large_10mb";

interface CleanupOption {
  id: CleanupCategory;
  icon: React.ElementType;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  count: number;
  color: ExorcismCardColor;
  requiresSync?: boolean;
}

interface QuickExorcismSectionProps {
  stats: QuickStats;
  syncProgress: SyncProgress | null;
  isSyncing?: boolean;
  selectable?: boolean;
  selectedCategories?: Set<CleanupCategory>;
  onSelectionChange?: (categories: Set<CleanupCategory>) => void;
  onExorcise?: (categories: CleanupCategory[]) => void;
}

function formatNumber(num: number | null | undefined): string {
  if (num == null) return "0";
  return num.toLocaleString();
}

export function QuickExorcismSection({
  stats,
  syncProgress,
  isSyncing = false,
  selectable = false,
  selectedCategories: externalSelected,
  onSelectionChange,
  onExorcise,
}: QuickExorcismSectionProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [internalSelected, setInternalSelected] = useState<Set<CleanupCategory>>(
    new Set()
  );

  // Use external state if provided, otherwise use internal
  const selectedCategories = externalSelected ?? internalSelected;
  const setSelectedCategories = onSelectionChange ?? setInternalSelected;

  const syncComplete = syncProgress?.status === "completed";
  const actionsDisabled = isSyncing;

  const categoryOptions: CleanupOption[] = [
    {
      id: "promotions",
      icon: Tag,
      titleKey: "quickCleanup.promotions",
      descKey: "quickCleanup.promotions.desc",
      count: stats.categories.promotions,
      color: "pink",
    },
    {
      id: "social",
      icon: Users,
      titleKey: "quickCleanup.social",
      descKey: "quickCleanup.social.desc",
      count: stats.categories.social,
      color: "blue",
    },
    {
      id: "updates",
      icon: Bell,
      titleKey: "quickCleanup.updates",
      descKey: "quickCleanup.updates.desc",
      count: stats.categories.updates,
      color: "yellow",
    },
    {
      id: "forums",
      icon: MessageSquare,
      titleKey: "quickCleanup.forums",
      descKey: "quickCleanup.forums.desc",
      count: stats.categories.forums,
      color: "green",
    },
  ];

  const advancedOptions: CleanupOption[] = [
    {
      id: "old_2years",
      icon: Calendar,
      titleKey: "deepCleanup.ancient",
      descKey: "deepCleanup.ancient.desc",
      count: stats.age.olderThan2Years ?? 0,
      color: "orange",
      requiresSync: true,
    },
    {
      id: "old_1year",
      icon: Clock,
      titleKey: "deepCleanup.stale",
      descKey: "deepCleanup.stale.desc",
      count: stats.age.olderThan1Year ?? 0,
      color: "purple",
      requiresSync: true,
    },
    {
      id: "large_10mb",
      icon: HardDrive,
      titleKey: "deepCleanup.heavy",
      descKey: "deepCleanup.heavy.desc",
      count: stats.size.larger10MB ?? 0,
      color: "pink",
      requiresSync: true,
    },
    {
      id: "large_5mb",
      icon: Archive,
      titleKey: "deepCleanup.bloated",
      descKey: "deepCleanup.bloated.desc",
      count: stats.size.larger5MB ?? 0,
      color: "blue",
      requiresSync: true,
    },
  ];

  const toggleCategory = (id: CleanupCategory) => {
    const next = new Set(selectedCategories);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedCategories(next);
  };

  const selectCategories = (ids: CleanupCategory[]) => {
    setSelectedCategories(new Set(ids));
  };

  const allOptions = [...categoryOptions, ...advancedOptions];
  const totalSelected = allOptions
    .filter((opt) => selectedCategories.has(opt.id))
    .reduce((sum, opt) => sum + opt.count, 0);

  const hasSelection = selectedCategories.size > 0;

  // Navigate to cleanup page with appropriate filter
  const navigateToCleanup = (categoryId: CleanupCategory) => {
    const filters = getCleanupPresetFilters(categoryId);
    const url = buildFilteredUrl("/cleanup", filters);
    navigate({ to: url });
  };

  const handleCardClick = (option: CleanupOption, isDisabled: boolean) => {
    if (isDisabled) return;

    if (selectable) {
      toggleCategory(option.id);
    } else if (onExorcise) {
      // If onExorcise callback is provided (e.g., on Cleanup page), use it
      onExorcise([option.id]);
    } else {
      // No callback, navigate to cleanup with filters (e.g., from Overview page)
      navigateToCleanup(option.id);
    }
  };

  const handlePowerMoveClick = (categories: CleanupCategory[]) => {
    if (selectable) {
      selectCategories(categories);
    } else if (onExorcise) {
      // If onExorcise callback is provided, use it
      onExorcise(categories);
    } else {
      // Navigate to cleanup with the first category filter
      // (API doesn't support OR filters, so we use the first one)
      navigateToCleanup(categories[0]);
    }
  };

  return (
    <div className="space-y-8">
      {/* Selection Summary - only show in selectable mode */}
      {selectable && hasSelection && !actionsDisabled && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Trash2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">
                    {formatNumber(totalSelected)} emails selected
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedCategories.size}{" "}
                    {selectedCategories.size === 1 ? "category" : "categories"}
                  </p>
                </div>
              </div>
              <Button onClick={() => onExorcise?.(Array.from(selectedCategories))}>
                <Trash2 className="h-4 w-4 mr-2" />
                Begin Exorcism
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Cleanup Section */}
      <div>
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{t("quickCleanup.title")}</h2>
            {actionsDisabled && (
              <Badge variant="secondary" className="text-xs">
                {t("quickCleanup.badge")}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {t("quickCleanup.description")}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {categoryOptions.map((option) => (
            <ExorcismCard
              key={option.id}
              icon={option.icon}
              title={t(option.titleKey)}
              description={t(option.descKey)}
              count={actionsDisabled ? "—" : option.count}
              color={option.color}
              disabled={actionsDisabled}
              selected={selectable && selectedCategories.has(option.id)}
              onClick={() => handleCardClick(option, actionsDisabled)}
            />
          ))}
        </div>
      </div>

      {/* Deep Cleanup Section */}
      <div>
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{t("deepCleanup.title")}</h2>
            {!syncComplete && (
              <Badge variant="secondary" className="text-xs">
                {t("deepCleanup.badge")}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {syncComplete
              ? t("deepCleanup.description.ready")
              : t("deepCleanup.description.waiting")}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {advancedOptions.map((option) => {
            const isDisabled = !!(option.requiresSync && !syncComplete);
            return (
              <ExorcismCard
                key={option.id}
                icon={option.icon}
                title={t(option.titleKey)}
                description={t(option.descKey)}
                count={isDisabled ? "—" : option.count}
                color={option.color}
                disabled={isDisabled}
                selected={selectable && selectedCategories.has(option.id)}
                onClick={() => handleCardClick(option, isDisabled)}
              />
            );
          })}
        </div>
      </div>

      {/* Power Moves */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            {t("powerMoves.title")}
          </CardTitle>
          <CardDescription>{t("powerMoves.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            <button
              className={`relative p-4 rounded-xl text-left transition-shadow bg-gradient-to-br from-pink-500 to-purple-600 text-white ${
                actionsDisabled ? "cursor-not-allowed" : "hover:shadow-lg"
              }`}
              disabled={actionsDisabled}
              onClick={() => handlePowerMoveClick(["promotions", "social"])}
            >
              {actionsDisabled && (
                <div className="absolute inset-0 bg-white/60 dark:bg-black/50 rounded-xl backdrop-blur-[1px]" />
              )}
              <Tag
                className={`relative h-6 w-6 mb-2 ${actionsDisabled ? "opacity-60" : ""}`}
              />
              <p
                className={`relative font-semibold ${actionsDisabled ? "opacity-60" : ""}`}
              >
                {t("powerMoves.promoPurge")}
              </p>
              <p
                className={`relative text-sm text-white/80 ${actionsDisabled ? "opacity-60" : ""}`}
              >
                {t("powerMoves.promoPurge.desc")}
              </p>
              <p
                className={`relative text-lg font-bold mt-2 ${actionsDisabled ? "opacity-60" : ""}`}
              >
                {actionsDisabled
                  ? "—"
                  : `${formatNumber(stats.categories.promotions + stats.categories.social)} emails`}
              </p>
            </button>
            <button
              className={`relative p-4 rounded-xl text-left transition-shadow bg-gradient-to-br from-orange-500 to-red-600 text-white ${
                !syncComplete ? "cursor-not-allowed" : "hover:shadow-lg"
              }`}
              disabled={!syncComplete}
              onClick={() => handlePowerMoveClick(["old_2years"])}
            >
              {!syncComplete && (
                <div className="absolute inset-0 bg-white/60 dark:bg-black/50 rounded-xl backdrop-blur-[1px]" />
              )}
              <Calendar
                className={`relative h-6 w-6 mb-2 ${!syncComplete ? "opacity-60" : ""}`}
              />
              <p
                className={`relative font-semibold ${!syncComplete ? "opacity-60" : ""}`}
              >
                {t("powerMoves.thePurge")}
              </p>
              <p
                className={`relative text-sm text-white/80 ${!syncComplete ? "opacity-60" : ""}`}
              >
                {t("powerMoves.thePurge.desc")}
              </p>
              <p
                className={`relative text-lg font-bold mt-2 ${!syncComplete ? "opacity-60" : ""}`}
              >
                {syncComplete
                  ? `${formatNumber(stats.age.olderThan2Years)} emails`
                  : "—"}
              </p>
            </button>
            <button
              className={`relative p-4 rounded-xl text-left transition-shadow bg-gradient-to-br from-blue-500 to-cyan-600 text-white ${
                !syncComplete ? "cursor-not-allowed" : "hover:shadow-lg"
              }`}
              disabled={!syncComplete}
              onClick={() => handlePowerMoveClick(["large_10mb"])}
            >
              {!syncComplete && (
                <div className="absolute inset-0 bg-white/60 dark:bg-black/50 rounded-xl backdrop-blur-[1px]" />
              )}
              <HardDrive
                className={`relative h-6 w-6 mb-2 ${!syncComplete ? "opacity-60" : ""}`}
              />
              <p
                className={`relative font-semibold ${!syncComplete ? "opacity-60" : ""}`}
              >
                {t("powerMoves.spaceSaver")}
              </p>
              <p
                className={`relative text-sm text-white/80 ${!syncComplete ? "opacity-60" : ""}`}
              >
                {t("powerMoves.spaceSaver.desc")}
              </p>
              <p
                className={`relative text-lg font-bold mt-2 ${!syncComplete ? "opacity-60" : ""}`}
              >
                {syncComplete
                  ? `${formatNumber(stats.size.larger10MB)} emails`
                  : "—"}
              </p>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export type { CleanupCategory };
