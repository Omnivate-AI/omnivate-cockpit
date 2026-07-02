"use client"

import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "./theme-toggle"
import { NotificationCenter } from "./notification-center"
import { CommandPalette } from "./command-palette"
import { AutoRefresh } from "./auto-refresh"

const ROUTE_LABELS: Record<string, string> = {
  "": "Dashboard",
  domains: "Domains",
  accounts: "Accounts",
  health: "Health",
  alerts: "Alerts",
  audit: "Audit Log",
  settings: "Settings",
  clients: "Clients",
  onboarding: "Onboarding",
}

interface HeaderProps {
  onMenuClick: () => void
  alertCount?: number
  clients?: string[]
}

export function Header({ onMenuClick, alertCount = 0, clients = [] }: HeaderProps) {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  const breadcrumbs = segments.length === 0
    ? [{ label: "Dashboard", href: "/" }]
    : segments.map((segment, i) => ({
        label: ROUTE_LABELS[segment] || decodeURIComponent(segment).replace(/^\w/, c => c.toUpperCase()),
        href: "/" + segments.slice(0, i + 1).join("/"),
      }))

  return (
    <header className="flex h-16 items-center justify-between border-b border-stone-200 dark:border-border bg-white dark:bg-card px-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 md:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <nav className="flex items-center gap-1 text-sm">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-1">
              {i > 0 && (
                <span className="text-muted-foreground mx-1">/</span>
              )}
              {i === breadcrumbs.length - 1 ? (
                <span className="font-medium text-foreground">{crumb.label}</span>
              ) : (
                <span className="text-muted-foreground">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <AutoRefresh />
        <CommandPalette clients={clients} />
        <NotificationCenter alertCount={alertCount} />
        <ThemeToggle />
      </div>
    </header>
  )
}
