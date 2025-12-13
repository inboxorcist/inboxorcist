import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { QuickStats, SyncProgress } from "@/lib/api";
import { QuickExorcismSection, type CleanupCategory } from "./QuickExorcismSection";

interface CleanupPageProps {
  stats: QuickStats | null;
  syncProgress: SyncProgress | null;
  isSyncing?: boolean;
}

export function CleanupPage({ stats, syncProgress, isSyncing = false }: CleanupPageProps) {
  const [selectedCategories, setSelectedCategories] = useState<Set<CleanupCategory>>(
    new Set()
  );

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="h-10 w-10 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Stats not available</p>
      </div>
    );
  }

  const handleExorcise = (categories: CleanupCategory[]) => {
    // TODO: Implement exorcism logic
    console.log("Exorcising categories:", categories);
  };

  return (
    <QuickExorcismSection
      stats={stats}
      syncProgress={syncProgress}
      isSyncing={isSyncing}
      selectable
      selectedCategories={selectedCategories}
      onSelectionChange={setSelectedCategories}
      onExorcise={handleExorcise}
    />
  );
}
