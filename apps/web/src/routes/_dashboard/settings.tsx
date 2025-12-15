import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/domain/SettingsPage";
import { useAppContext } from "../__root";

export const Route = createFileRoute("/_dashboard/settings")({
  component: SettingsRoute,
});

function SettingsRoute() {
  const { accounts, removeAccount, connectAccount } = useAppContext();

  return (
    <SettingsPage
      accounts={accounts}
      onDisconnect={removeAccount}
      onAddAccount={connectAccount}
    />
  );
}
