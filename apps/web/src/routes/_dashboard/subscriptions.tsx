import { createFileRoute } from '@tanstack/react-router'
import { SubscriptionsPage } from '@/components/domain/SubscriptionsPage'
import { useAppContext } from '../__root'

export const Route = createFileRoute('/_dashboard/subscriptions')({
  component: SubscriptionsRoute,
})

function SubscriptionsRoute() {
  const { selectedAccountId, syncStatus, syncStartedAt, syncCompletedAt, refetchStats } =
    useAppContext()

  if (!selectedAccountId) {
    return null
  }

  return (
    <SubscriptionsPage
      accountId={selectedAccountId}
      syncStatus={syncStatus}
      syncStartedAt={syncStartedAt}
      syncCompletedAt={syncCompletedAt}
      onSyncComplete={refetchStats}
    />
  )
}
