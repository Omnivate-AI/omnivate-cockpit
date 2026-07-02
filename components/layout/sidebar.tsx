"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Mail,
  Bell,
  ScrollText,
  Settings,
  LogOut,
  Plus,
  GitCompareArrows,
  FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { FLAGS } from "@/lib/flags"
import { clientLabel } from "@/lib/types"

const CLIENT_COLORS: Record<string, string> = {
  roosterpunk: "bg-rose-500",
  gladlane: "bg-emerald-500",
  orbitalx: "bg-blue-500",
  valda: "bg-amber-500",
  pantheon: "bg-violet-500",
  omnivate: "bg-indigo-500",
  cylindo: "bg-cyan-500",
}

const FALLBACK_COLORS = [
  "bg-teal-500",
  "bg-cyan-500",
  "bg-pink-500",
  "bg-lime-500",
  "bg-orange-500",
  "bg-sky-500",
  "bg-fuchsia-500",
  "bg-yellow-500",
]

function getClientColor(client: string): string {
  if (CLIENT_COLORS[client]) return CLIENT_COLORS[client]
  // Deterministic hash for consistent color assignment
  let hash = 0
  for (let i = 0; i < client.length; i++) {
    hash = (hash * 31 + client.charCodeAt(i)) | 0
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length]
}

const TOP_NAV_ITEMS = [
  { label: "Command Center", href: "/", icon: LayoutDashboard },
] as const

const BOTTOM_NAV_ITEMS = [
  { label: "Digest", href: "/digest", icon: FileText },
  { label: "Alerts", href: "/alerts", icon: Bell },
  { label: "Audit Log", href: "/audit", icon: ScrollText },
  { label: "Settings", href: "/settings", icon: Settings },
] as const

interface SidebarProps {
  alertCount?: number
  clients: string[]
  onNavigate?: () => void
}

export function Sidebar({ alertCount = 0, clients, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  function isActive(href: string) {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const activeClientSlug = pathname.startsWith("/clients/")
    ? pathname.split("/")[2]
    : null

  function handleClientClick(client: string) {
    router.push(`/clients/${client}`)
    onNavigate?.()
  }

  const linkClasses = (href: string) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150",
      isActive(href)
        ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400"
        : "text-muted-foreground hover:bg-stone-100 dark:hover:bg-accent hover:text-foreground"
    )

  return (
    <div className="flex h-full flex-col bg-white dark:bg-card border-r border-stone-200 dark:border-border">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-5 border-b border-stone-100 dark:border-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <Mail className="h-4 w-4" />
        </div>
        <span className="text-base font-semibold text-foreground">Deliverability Hub</span>
      </div>

      {/* Top nav: Command Center */}
      <nav className="px-3 pt-4 pb-2 space-y-1">
        {TOP_NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={linkClasses(item.href)}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Clients section */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <p className="px-3 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Clients
        </p>
        <div className="space-y-0.5">
          {clients.map((client) => (
            <button
              key={client}
              onClick={() => handleClientClick(client)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
                activeClientSlug === client
                  ? "bg-stone-100 dark:bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:bg-stone-50 dark:hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  getClientColor(client)
                )}
              />
              <span>{clientLabel(client)}</span>
            </button>
          ))}
          {FLAGS.onboarding && (
            <button
              onClick={() => {
                router.push("/onboarding")
                onNavigate?.()
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
                pathname.startsWith("/onboarding")
                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 font-medium"
                  : "text-muted-foreground hover:bg-stone-50 dark:hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Client</span>
            </button>
          )}
          <Link
            href="/compare"
            onClick={onNavigate}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
              isActive("/compare")
                ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 font-medium"
                : "text-muted-foreground hover:bg-stone-50 dark:hover:bg-accent/50 hover:text-foreground"
            )}
          >
            <GitCompareArrows className="h-3.5 w-3.5" />
            <span>Compare</span>
          </Link>
        </div>
      </div>

      {/* Bottom nav: Alerts, Audit Log, Settings */}
      <nav className="border-t border-stone-100 dark:border-border px-3 py-3 space-y-1">
        {BOTTOM_NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={linkClasses(item.href)}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
            {item.label === "Alerts" && alertCount > 0 && (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/50 px-1.5 text-xs font-medium text-rose-700 dark:text-rose-400">
                {alertCount}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* Sign Out */}
      <div className="border-t border-stone-100 dark:border-border px-3 py-3">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-stone-100 dark:hover:bg-accent hover:text-foreground transition-colors duration-150"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  )
}
