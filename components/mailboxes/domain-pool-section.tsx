"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  Star,
  Search,
  Check,
  X,
  Loader2,
  Package,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronRight,
} from "lucide-react"
import { toast } from "sonner"

export interface DomainCandidate {
  id: number
  client: string
  domain_name: string
  available: boolean
  google_workspace_available: boolean
  ms365_workspace_available: boolean
  registration_price: number
  checked_at: string
  status: string
  favorited: boolean
  notes: string | null
}

interface DomainPoolSectionProps {
  client: string
  onOrderClick: (domains: DomainCandidate[]) => void
  refreshKey?: number // bump to trigger refetch
}

type TabMode = "available" | "favourites" | "ordered"
type SortField = "domain_name" | "registration_price"
type SortDir = "asc" | "desc"

export function DomainPoolSection({ client, onOrderClick, refreshKey }: DomainPoolSectionProps) {
  const [domains, setDomains] = useState<DomainCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [tab, setTab] = useState<TabMode>("favourites")
  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set())

  const fetchDomains = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/clients/${client}/domain-candidates`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data: DomainCandidate[] = await res.json()
      setDomains(data)
    } catch {
      toast.error("Failed to load domain pool")
    } finally {
      setLoading(false)
    }
  }, [client])

  useEffect(() => {
    fetchDomains()
  }, [fetchDomains, refreshKey])

  // Counts
  const counts = useMemo(() => {
    const available = domains.filter((d) => d.available && d.status === "candidate").length
    const favourited = domains.filter((d) => d.favorited && d.status === "candidate").length
    const ordered = domains.filter((d) => d.status === "ordered").length
    return { available, favourited, ordered }
  }, [domains])

  // Tab-filtered list
  const tabFiltered = useMemo(() => {
    switch (tab) {
      case "available":
        return domains.filter((d) => d.available && d.status === "candidate")
      case "favourites":
        return domains.filter((d) => d.favorited && d.status === "candidate")
      case "ordered":
        return domains.filter((d) => d.status === "ordered")
    }
  }, [domains, tab])

  // Search filter
  const searched = useMemo(() => {
    if (!search) return tabFiltered
    const q = search.toLowerCase()
    return tabFiltered.filter((d) => d.domain_name.toLowerCase().includes(q))
  }, [tabFiltered, search])

  // Sort
  const sorted = useMemo(() => {
    const list = [...searched]
    list.sort((a, b) => {
      if (tab === "available" && a.favorited !== b.favorited) return a.favorited ? -1 : 1
      if (sortField) {
        const cmp =
          sortField === "domain_name"
            ? a.domain_name.localeCompare(b.domain_name)
            : (a.registration_price ?? 0) - (b.registration_price ?? 0)
        return sortDir === "asc" ? cmp : -cmp
      }
      return a.domain_name.localeCompare(b.domain_name)
    })
    return list
  }, [searched, sortField, sortDir, tab])

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
      else {
        setSortField(field)
        setSortDir("asc")
      }
    },
    [sortField]
  )

  const toggleFavorite = useCallback(
    async (domain: DomainCandidate) => {
      const newFavorited = !domain.favorited
      setDomains((prev) =>
        prev.map((d) => (d.id === domain.id ? { ...d, favorited: newFavorited } : d))
      )
      setTogglingIds((prev) => new Set(prev).add(domain.id))
      try {
        const res = await fetch(`/api/clients/${client}/domain-candidates`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: domain.id, favorited: newFavorited }),
        })
        if (!res.ok) throw new Error()
      } catch {
        setDomains((prev) =>
          prev.map((d) => (d.id === domain.id ? { ...d, favorited: !newFavorited } : d))
        )
        toast.error(`Failed to update ${domain.domain_name}`)
      } finally {
        setTogglingIds((prev) => {
          const next = new Set(prev)
          next.delete(domain.id)
          return next
        })
      }
    },
    [client]
  )

  const bulkFavorite = useCallback(async () => {
    if (selected.size === 0) return
    const targets = domains.filter((d) => selected.has(d.id))
    const allFav = targets.every((d) => d.favorited)
    const newFav = !allFav
    setDomains((prev) =>
      prev.map((d) => (selected.has(d.id) ? { ...d, favorited: newFav } : d))
    )
    const results = await Promise.allSettled(
      targets.map((d) =>
        fetch(`/api/clients/${client}/domain-candidates`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: d.id, favorited: newFav }),
        })
      )
    )
    const failed = results.filter((r) => r.status === "rejected").length
    if (failed > 0) {
      toast.error(`${failed} update(s) failed`)
      fetchDomains()
    } else {
      toast.success(newFav ? `${targets.length} favourited` : `${targets.length} unfavourited`)
    }
    setSelected(new Set())
  }, [selected, domains, client, fetchDomains])

  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selected.size === sorted.length && sorted.length > 0) setSelected(new Set())
    else setSelected(new Set(sorted.map((d) => d.id)))
  }, [sorted, selected.size])

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5" />
    return sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
  }

  // Order button logic
  const orderData = useMemo(() => {
    const selectedAvailable = domains.filter(
      (d) => selected.has(d.id) && d.available && d.status === "candidate"
    )
    const useSelected = selectedAvailable.length > 0
    const list = useSelected
      ? selectedAvailable
      : domains.filter((d) => d.favorited && d.available && d.status === "candidate")
    const label = useSelected
      ? `Order Selected (${selectedAvailable.length})`
      : `Order from Favourites`
    return { list, label }
  }, [domains, selected])

  const tabs: { key: TabMode; label: string; count: number }[] = [
    { key: "favourites", label: "Favourites", count: counts.favourited },
    { key: "available", label: "Available", count: counts.available },
    { key: "ordered", label: "Ordered", count: counts.ordered },
  ]

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading domain pool...</span>
        </CardContent>
      </Card>
    )
  }

  // Empty state — no candidates generated yet
  if (domains.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <div className="rounded-full bg-indigo-50 dark:bg-indigo-950/50 p-3 mb-3">
            <Package className="h-6 w-6 text-indigo-500" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Add Capacity</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            No domain candidates in the pool yet. Generate domain candidates to expand your mailbox capacity.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card>
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors text-left">
            <div className="flex items-center gap-3">
              <ChevronRight
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  expanded && "rotate-90"
                )}
              />
              <h3 className="text-sm font-semibold">Domain Pool</h3>
              <div className="flex gap-2">
                <Badge variant="secondary" className="text-xs">{counts.available} available</Badge>
                {counts.favourited > 0 && (
                  <Badge variant="outline" className="text-xs">
                    <Star className="mr-1 h-3 w-3 fill-amber-400 text-amber-400" />
                    {counts.favourited}
                  </Badge>
                )}
                {counts.ordered > 0 && (
                  <Badge className="text-xs">{counts.ordered} ordered</Badge>
                )}
              </div>
            </div>
            {!expanded && counts.favourited > 0 && (
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  setExpanded(true)
                  setTab("favourites")
                }}
              >
                <Package className="mr-1.5 h-3.5 w-3.5" />
                Order Domains
              </Button>
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0 pb-4">
            {/* Tabs + Search + Actions */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                {tabs.map((t) => (
                  <Button
                    key={t.key}
                    variant={tab === t.key ? "default" : "ghost"}
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => { setTab(t.key); setSelected(new Set()); setSearch("") }}
                  >
                    {t.label} ({t.count})
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {selected.size > 0 && tab !== "ordered" && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={bulkFavorite}>
                    <Star className="mr-1 h-3 w-3" />
                    {domains.filter((d) => selected.has(d.id)).every((d) => d.favorited)
                      ? "Unfav"
                      : "Fav"}{" "}
                    ({selected.size})
                  </Button>
                )}
                {tab === "favourites" && (
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    disabled={orderData.list.length === 0}
                    onClick={() => onOrderClick(orderData.list)}
                  >
                    <Package className="mr-1 h-3 w-3" />
                    {orderData.label}
                  </Button>
                )}
              </div>
            </div>

            {/* Search */}
            <div className="relative max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search domains..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            {/* Table with max height */}
            {sorted.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                {tab === "ordered" ? "No ordered domains yet." : "No domains match."}
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      {tab !== "ordered" && (
                        <TableHead className="w-10">
                          <Checkbox
                            checked={selected.size === sorted.length && sorted.length > 0}
                            onCheckedChange={toggleSelectAll}
                            aria-label="Select all"
                          />
                        </TableHead>
                      )}
                      <TableHead>
                        <button
                          onClick={() => handleSort("domain_name")}
                          className={cn(
                            "inline-flex items-center gap-1 text-xs hover:text-foreground transition-colors",
                            sortField === "domain_name" ? "text-foreground" : "text-muted-foreground"
                          )}
                        >
                          Domain <SortIcon field="domain_name" />
                        </button>
                      </TableHead>
                      {tab !== "ordered" && (
                        <>
                          <TableHead className="w-20">
                            <button
                              onClick={() => handleSort("registration_price")}
                              className={cn(
                                "inline-flex items-center gap-1 text-xs hover:text-foreground transition-colors",
                                sortField === "registration_price" ? "text-foreground" : "text-muted-foreground"
                              )}
                            >
                              Price <SortIcon field="registration_price" />
                            </button>
                          </TableHead>
                          <TableHead className="w-16 text-center text-xs">G</TableHead>
                          <TableHead className="w-16 text-center text-xs">MS</TableHead>
                          <TableHead className="w-12 text-center text-xs">Fav</TableHead>
                        </>
                      )}
                      {tab === "ordered" && (
                        <TableHead className="w-24 text-xs">Status</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((domain) => (
                      <TableRow
                        key={domain.id}
                        className={cn(
                          "h-9",
                          domain.favorited && tab === "available" && "bg-amber-50/50 dark:bg-amber-950/10"
                        )}
                      >
                        {tab !== "ordered" && (
                          <TableCell className="py-1">
                            <Checkbox
                              checked={selected.has(domain.id)}
                              onCheckedChange={() => toggleSelect(domain.id)}
                            />
                          </TableCell>
                        )}
                        <TableCell className="py-1 text-xs font-medium">{domain.domain_name}</TableCell>
                        {tab !== "ordered" && (
                          <>
                            <TableCell className="py-1">
                              <span className="font-mono text-xs text-muted-foreground">
                                ${(domain.registration_price ?? 0).toFixed(2)}
                              </span>
                            </TableCell>
                            <TableCell className="py-1 text-center">
                              {domain.google_workspace_available ? (
                                <Check className="mx-auto h-3.5 w-3.5 text-green-600" />
                              ) : (
                                <X className="mx-auto h-3.5 w-3.5 text-red-400" />
                              )}
                            </TableCell>
                            <TableCell className="py-1 text-center">
                              {domain.ms365_workspace_available ? (
                                <Check className="mx-auto h-3.5 w-3.5 text-green-600" />
                              ) : (
                                <X className="mx-auto h-3.5 w-3.5 text-red-400" />
                              )}
                            </TableCell>
                            <TableCell className="py-1 text-center">
                              <button
                                onClick={() => toggleFavorite(domain)}
                                disabled={togglingIds.has(domain.id)}
                                className="inline-flex items-center justify-center rounded p-0.5 hover:bg-muted transition-colors disabled:opacity-50"
                              >
                                <Star
                                  className={cn(
                                    "h-3.5 w-3.5 transition-colors",
                                    domain.favorited
                                      ? "fill-amber-400 text-amber-400"
                                      : "text-muted-foreground hover:text-amber-400"
                                  )}
                                />
                              </button>
                            </TableCell>
                          </>
                        )}
                        {tab === "ordered" && (
                          <TableCell className="py-1">
                            <Badge variant="default" className="text-[10px]">Ordered</Badge>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {sorted.length} domain{sorted.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
