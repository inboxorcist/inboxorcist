import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAppContext } from "./__root";

export const Route = createFileRoute("/_dashboard")({
  component: DashboardLayoutRoute,
});

function DashboardLayoutRoute() {
  const {
    accounts,
    selectedAccountId,
    selectAccount,
    syncStatus,
    statsError,
    syncError,
    connectAccount,
  } = useAppContext();

  // If no selected account, the root will handle redirect
  if (!selectedAccountId) {
    return null;
  }

  return (
    <DashboardLayout
      accounts={accounts}
      selectedAccountId={selectedAccountId}
      onSelectAccount={selectAccount}
      syncStatus={syncStatus}
      statsError={statsError}
      syncError={syncError}
      onAddAccount={connectAccount}
    >
      <Outlet />
    </DashboardLayout>
  );
}
