import { createFileRoute } from '@tanstack/react-router'
import { CleanupPage } from '@/components/domain/CleanupPage'
import { useAppContext } from '../__root'

export const Route = createFileRoute('/_dashboard/cleanup')({
  component: CleanupRoute,
})

function CleanupRoute() {
  const {
    selectedAccountId,
    stats,
    syncProgress,
    syncStatus,
    syncStartedAt,
    syncCompletedAt,
    isSyncing,
    refetchStats,
  } = useAppContext()

  if (!selectedAccountId) {
    return null
  }

  return (
    <CleanupPage
      accountId={selectedAccountId}
      stats={stats}
      syncProgress={syncProgress}
      syncStatus={syncStatus}
      syncStartedAt={syncStartedAt}
      syncCompletedAt={syncCompletedAt}
      isSyncing={isSyncing}
      onSyncComplete={refetchStats}
    />
  )
}
