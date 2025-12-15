import { createFileRoute } from "@tanstack/react-router";
import { OverviewPage } from "@/components/domain/OverviewPage";
import { useAppContext } from "../__root";

export const Route = createFileRoute("/_dashboard/")({
  component: OverviewRoute,
});

function OverviewRoute() {
  const {
    selectedAccountId,
    stats,
    syncProgress,
    syncStatus,
    syncStartedAt,
    syncCompletedAt,
    isSyncing,
    refetchStats,
  } = useAppContext();

  if (!selectedAccountId) {
    return null;
  }

  return (
    <OverviewPage
      accountId={selectedAccountId}
      stats={stats}
      syncProgress={syncProgress}
      syncStatus={syncStatus}
      syncStartedAt={syncStartedAt}
      syncCompletedAt={syncCompletedAt}
      isSyncing={isSyncing}
      onSyncComplete={refetchStats}
    />
  );
}
