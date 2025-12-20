import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_dashboard/filters')({
  component: FiltersLayoutRoute,
})

function FiltersLayoutRoute() {
  return <Outlet />
}
