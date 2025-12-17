import { createFileRoute } from '@tanstack/react-router'
import { ExplorerPage } from '@/components/domain/ExplorerPage'
import { useAppContext } from '../__root'

interface ExplorerSearchParams {
  selectAll?: boolean
}

export const Route = createFileRoute('/_dashboard/explorer')({
  component: ExplorerRoute,
  validateSearch: (search: Record<string, unknown>): ExplorerSearchParams => {
    const selectAll = search.selectAll === 'true' || search.selectAll === true
    return selectAll ? { selectAll: true } : {}
  },
})

function ExplorerRoute() {
  const { selectedAccountId, syncStatus, syncStartedAt, syncCompletedAt, refetchStats } =
    useAppContext()
  const { selectAll } = Route.useSearch()

  if (!selectedAccountId) {
    return null
  }

  return (
    <ExplorerPage
      accountId={selectedAccountId}
      syncStatus={syncStatus}
      syncStartedAt={syncStartedAt}
      syncCompletedAt={syncCompletedAt}
      onSyncComplete={refetchStats}
      autoSelectAll={selectAll}
    />
  )
}
