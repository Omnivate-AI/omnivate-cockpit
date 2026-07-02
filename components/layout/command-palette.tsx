"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import {
  LayoutDashboard,
  Bell,
  ScrollText,
  Settings,
  Search,
  Users,
  GitCompareArrows,
  FileText,
  RefreshCw,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { clientLabel } from "@/lib/types"

interface CommandItem {
  id: string
  label: string
  category: "Navigation" | "Clients" | "Actions"
  icon: React.ElementType
  action: () => void
  keywords?: string[]
}

interface CommandPaletteProps {
  clients: string[]
}

const TAB_VALUES = [
  "overview",
  "campaigns",
  "pipelines",
  "mailboxes",
  "placement",
  "alerts",
  "settings",
] as const

export function CommandPalette({ clients }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const navigate = useCallback(
    (href: string) => {
      router.push(href)
      setOpen(false)
    },
    [router]
  )

  const items = useMemo<CommandItem[]>(() => {
    const nav: CommandItem[] = [
      {
        id: "nav-home",
        label: "Command Center",
        category: "Navigation",
        icon: LayoutDashboard,
        action: () => navigate("/"),
        keywords: ["dashboard", "home"],
      },
      {
        id: "nav-alerts",
        label: "Alerts",
        category: "Navigation",
        icon: Bell,
        action: () => navigate("/alerts"),
      },
      {
        id: "nav-audit",
        label: "Audit Log",
        category: "Navigation",
        icon: ScrollText,
        action: () => navigate("/audit"),
      },
      {
        id: "nav-settings",
        label: "Settings",
        category: "Navigation",
        icon: Settings,
        action: () => navigate("/settings"),
      },
      {
        id: "nav-compare",
        label: "Compare Clients",
        category: "Navigation",
        icon: GitCompareArrows,
        action: () => navigate("/compare"),
        keywords: ["compare"],
      },
      {
        id: "nav-digest",
        label: "Daily Digest",
        category: "Navigation",
        icon: FileText,
        action: () => navigate("/digest"),
        keywords: ["digest", "summary", "report"],
      },
    ]

    const clientItems: CommandItem[] = clients.map((c) => ({
      id: `client-${c}`,
      label: clientLabel(c),
      category: "Clients",
      icon: Users,
      action: () => navigate(`/clients/${c}`),
      keywords: [c],
    }))

    const actions: CommandItem[] = [
      {
        id: "action-refresh",
        label: "Refresh Page",
        category: "Actions",
        icon: RefreshCw,
        action: () => {
          router.refresh()
          setOpen(false)
        },
        keywords: ["reload", "sync"],
      },
    ]

    return [...nav, ...clientItems, ...actions]
  }, [clients, navigate, router])

  const filtered = useMemo(() => {
    if (!query.trim()) return items
    const q = query.toLowerCase()
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.keywords?.some((k) => k.includes(q))
    )
  }, [items, query])

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {}
    for (const item of filtered) {
      if (!groups[item.category]) groups[item.category] = []
      groups[item.category].push(item)
    }
    return groups
  }, [filtered])

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("")
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  // Cmd+K to open, Escape to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
        return
      }

      // Cmd+R to refresh (only when palette is closed)
      if ((e.metaKey || e.ctrlKey) && e.key === "r" && !open) {
        e.preventDefault()
        router.refresh()
        return
      }

      // Number keys 1-7 to switch client tabs (only on client page, palette closed)
      if (
        !open &&
        pathname.startsWith("/clients/") &&
        e.key >= "1" &&
        e.key <= "7" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        // Don't intercept if user is typing in an input
        const target = e.target as HTMLElement
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return
        }
        const tabIndex = parseInt(e.key) - 1
        if (tabIndex < TAB_VALUES.length) {
          e.preventDefault()
          const tabValue = TAB_VALUES[tabIndex]
          const slug = pathname.split("/")[2]
          if (tabValue === "overview") {
            router.push(`/clients/${slug}`)
          } else {
            router.push(`/clients/${slug}?tab=${tabValue}`)
          }
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, pathname, router])

  // Handle keyboard navigation in list
  function handleListKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1))
      scrollToSelected(selectedIndex + 1)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
      scrollToSelected(selectedIndex - 1)
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action()
      }
    }
  }

  function scrollToSelected(index: number) {
    const container = listRef.current
    if (!container) return
    const items = container.querySelectorAll("[data-command-item]")
    items[index]?.scrollIntoView({ block: "nearest" })
  }

  let flatIndex = 0

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-stone-200 dark:border-border bg-stone-50 dark:bg-accent/50 px-3 py-1.5 text-sm text-muted-foreground hover:bg-stone-100 dark:hover:bg-accent transition-colors"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-stone-300 dark:border-border bg-stone-100 dark:bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
          <DialogTitle className="sr-only">Command Palette</DialogTitle>
          {/* Search input */}
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleListKeyDown}
              placeholder="Search pages, clients, actions..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Results */}
          <div
            ref={listRef}
            className="max-h-[300px] overflow-y-auto py-2"
          >
            {filtered.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No results found.
              </p>
            )}

            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <p className="px-4 py-1.5 text-xs font-medium text-muted-foreground">
                  {category}
                </p>
                {items.map((item) => {
                  const idx = flatIndex++
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      data-command-item
                      onClick={() => item.action()}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors",
                        idx === selectedIndex
                          ? "bg-stone-100 dark:bg-accent text-foreground"
                          : "text-muted-foreground hover:bg-stone-50 dark:hover:bg-accent/50"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                      {item.category === "Clients" && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          client
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Footer hints */}
          <div className="border-t px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground">
            <span>↑↓ navigate</span>
            <span>↵ select</span>
            <span>esc close</span>
            {pathname.startsWith("/clients/") && (
              <span className="ml-auto">1-7 switch tabs</span>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
