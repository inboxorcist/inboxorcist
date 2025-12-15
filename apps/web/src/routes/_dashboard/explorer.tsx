import { createFileRoute } from "@tanstack/react-router";
import { ExplorerPage } from "@/components/domain/ExplorerPage";
import { useAppContext } from "../__root";

export const Route = createFileRoute("/_dashboard/explorer")({
  component: ExplorerRoute,
});

function ExplorerRoute() {
  const {
    selectedAccountId,
    syncStatus,
    syncStartedAt,
    syncCompletedAt,
    refetchStats,
  } = useAppContext();

  if (!selectedAccountId) {
    return null;
  }

  return (
    <ExplorerPage
      accountId={selectedAccountId}
      syncStatus={syncStatus}
      syncStartedAt={syncStartedAt}
      syncCompletedAt={syncCompletedAt}
      onSyncComplete={refetchStats}
    />
  );
}
