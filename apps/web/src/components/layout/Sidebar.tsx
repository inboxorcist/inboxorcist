import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Ghost,
  LayoutDashboard,
  Trash2,
  Settings,
  Plus,
  Mail,
  ChevronDown,
  Moon,
  Sun,
  Check,
  Search,
} from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { useTheme } from "@/hooks/useTheme";
import type { GmailAccount } from "@/lib/api";

interface SidebarProps {
  accounts: GmailAccount[];
  selectedAccountId: string;
  onSelectAccount: (accountId: string) => void;
  onAddAccount: () => void;
}

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick: () => void;
}

function NavItem({ icon: Icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
}

export function Sidebar({
  accounts,
  selectedAccountId,
  onSelectAccount,
  onAddAccount,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const { isExorcistMode, toggleExorcistMode } = useLanguage();

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  // Determine active page from pathname
  const getActivePage = () => {
    const path = location.pathname;
    if (path === "/" || path === "/overview") return "overview";
    if (path === "/explorer") return "explorer";
    if (path === "/cleanup") return "cleanup";
    if (path === "/settings") return "settings";
    return "overview";
  };

  const activePage = getActivePage();

  const navigateTo = (page: string) => {
    navigate(page === "overview" ? "/" : `/${page}`);
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 border-r bg-card flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b">
        <div className="flex items-center gap-2">
          <Ghost className="h-7 w-7 text-primary" />
          <span className="font-bold text-xl">Inboxorcist</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        <NavItem
          icon={LayoutDashboard}
          label="Overview"
          active={activePage === "overview"}
          onClick={() => navigateTo("overview")}
        />
        <NavItem
          icon={Search}
          label="Explorer"
          active={activePage === "explorer"}
          onClick={() => navigateTo("explorer")}
        />
        <NavItem
          icon={Trash2}
          label="Cleanup"
          active={activePage === "cleanup"}
          onClick={() => navigateTo("cleanup")}
        />
        <NavItem
          icon={Settings}
          label="Settings"
          active={activePage === "settings"}
          onClick={() => navigateTo("settings")}
        />
      </nav>

      {/* Account Section */}
      <div className="p-4 border-t space-y-3">
        {/* Account Selector Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium truncate">{selectedAccount?.email ?? "Select account"}</p>
                <p className="text-xs text-muted-foreground">
                  {accounts.length > 1 ? `${accounts.length} accounts` : "Connected"}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {/* Account List */}
            {accounts.map((account) => (
              <DropdownMenuItem
                key={account.id}
                onClick={() => onSelectAccount(account.id)}
                className="cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="truncate">{account.email}</span>
                  </div>
                  {account.id === selectedAccountId && (
                    <Check className="h-4 w-4 text-primary shrink-0 ml-2" />
                  )}
                </div>
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            {/* Dark Mode Toggle */}
            <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  <span>Dark Mode</span>
                </div>
                {isDark && <Check className="h-4 w-4 text-primary" />}
              </div>
            </DropdownMenuItem>

            {/* Exorcist Mode Toggle */}
            <DropdownMenuItem onClick={toggleExorcistMode} className="cursor-pointer">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Ghost className="h-4 w-4" />
                  <span>Exorcist Mode</span>
                </div>
                {isExorcistMode && <Check className="h-4 w-4 text-primary" />}
              </div>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Settings */}
            <DropdownMenuItem
              onClick={() => navigateTo("settings")}
              className="cursor-pointer"
            >
              <Settings className="h-4 w-4 mr-2" />
              <span>Settings</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Add Account Button */}
        <Button
          className="w-full justify-start"
          onClick={onAddAccount}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Account
        </Button>
      </div>
    </aside>
  );
}
