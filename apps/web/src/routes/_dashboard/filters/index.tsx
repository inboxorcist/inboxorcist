import { createFileRoute } from '@tanstack/react-router'
import { FiltersPage } from '@/components/domain/filters/FiltersPage'
import { useAppContext } from '@/routes/__root'

export const Route = createFileRoute('/_dashboard/filters/')({
  component: FiltersIndexRoute,
})

function FiltersIndexRoute() {
  const { selectedAccountId } = useAppContext()

  if (!selectedAccountId) {
    return null
  }

  return <FiltersPage accountId={selectedAccountId} />
}
