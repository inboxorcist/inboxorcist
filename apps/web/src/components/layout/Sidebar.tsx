import { useNavigate, useLocation } from '@tanstack/react-router'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Ghost,
  LayoutDashboard,
  Settings,
  Plus,
  Mail,
  ChevronDown,
  Moon,
  Sun,
  Check,
  Search,
  LogOut,
  MailMinus,
} from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { useTheme } from '@/hooks/useTheme'
import { useAuthContext } from '@/routes/__root'
import type { GmailAccount } from '@/lib/api'

interface SidebarProps {
  accounts: GmailAccount[]
  selectedAccountId: string
  onSelectAccount: (accountId: string) => void
  onAddAccount: () => void
}

interface NavItemProps {
  icon: React.ElementType
  label: string
  active?: boolean
  onClick: () => void
}

function NavItem({ icon: Icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      }`}
    >
      <Icon className="h-5 w-5" />
      {label}
    </button>
  )
}

export function Sidebar({
  accounts,
  selectedAccountId,
  onSelectAccount,
  onAddAccount,
}: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isDark, toggleTheme, setTheme } = useTheme()
  const { isExorcistMode, toggleExorcistMode } = useLanguage()

  // When enabling exorcist mode, also enable dark mode
  const handleExorcistToggle = () => {
    if (!isExorcistMode) {
      setTheme('dark')
    }
    toggleExorcistMode()
  }
  const { user, logout } = useAuthContext()

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId)

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (!user?.name) return user?.email?.[0]?.toUpperCase() ?? '?'
    const names = user.name.split(' ')
    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
    }
    return user.name[0].toUpperCase()
  }

  // Determine active page from pathname
  const getActivePage = () => {
    const path = location.pathname
    if (path === '/' || path === '/overview') return 'overview'
    if (path === '/explorer') return 'explorer'
    if (path === '/subscriptions') return 'subscriptions'
    if (path === '/settings') return 'settings'
    return 'overview'
  }

  const activePage = getActivePage()

  const navigateTo = (page: string) => {
    navigate({ to: page === 'overview' ? '/' : `/${page}` })
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 border-r bg-card flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Inboxorcist" className="h-8 w-8" />
          <span className="font-bold text-xl">Inboxorcist</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        <NavItem
          icon={LayoutDashboard}
          label="Overview"
          active={activePage === 'overview'}
          onClick={() => navigateTo('overview')}
        />
        <NavItem
          icon={Search}
          label="Explorer"
          active={activePage === 'explorer'}
          onClick={() => navigateTo('explorer')}
        />
        <NavItem
          icon={MailMinus}
          label="Subscriptions"
          active={activePage === 'subscriptions'}
          onClick={() => navigateTo('subscriptions')}
        />
        <NavItem
          icon={Settings}
          label="Settings"
          active={activePage === 'settings'}
          onClick={() => navigateTo('settings')}
        />
      </nav>

      {/* User Section */}
      <div className="p-4 border-t">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user?.picture ?? undefined} alt={user?.name ?? 'User'} />
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium truncate">{user?.name ?? 'User'}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {selectedAccount?.email ?? user?.email}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {/* Gmail Accounts */}
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

            {/* Add Account */}
            <DropdownMenuItem onClick={onAddAccount} className="cursor-pointer">
              <Plus className="h-4 w-4 mr-2" />
              <span>Add Gmail Account</span>
            </DropdownMenuItem>

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
            <DropdownMenuItem onClick={handleExorcistToggle} className="cursor-pointer">
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
            <DropdownMenuItem onClick={() => navigateTo('settings')} className="cursor-pointer">
              <Settings className="h-4 w-4 mr-2" />
              <span>Settings</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Logout */}
            <DropdownMenuItem
              onClick={logout}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
