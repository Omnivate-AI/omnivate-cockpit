"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Loader2,
  Building2,
  Globe,
  Users,
  Settings,
  Calculator,
  AlertTriangle,
  Pencil,
  Check,
  RefreshCw,
  Wallet,
  Mail,
  Monitor,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { ClientSetup } from "@/lib/types"

// ---------- Helpers ----------

function fmtCurrency(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  })
}

// ---------- Types ----------

interface Persona {
  first_name: string
  last_name: string
  profile_picture_url: string | null
}

interface SelectedDomain {
  name: string
  tld: string
  price: number
}

function getInitials(first: string, last: string): string {
  return (first.charAt(0) + last.charAt(0)).toUpperCase() || "?"
}

// ---------- Component ----------

export function ReviewStep() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setupId = searchParams.get("setupId")

  const [setup, setSetup] = useState<ClientSetup | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [purchasing, setPurchasing] = useState(false)
  const [domainsExpanded, setDomainsExpanded] = useState(false)

  // Live wallet balance
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [walletLoading, setWalletLoading] = useState(false)

  // Load setup data
  const loadSetup = useCallback(async () => {
    if (!setupId) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/onboarding/get-setup?id=${encodeURIComponent(setupId)}`
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to load setup")
        return
      }
      setSetup(data.setup)
    } catch {
      setError("Network error loading setup")
    } finally {
      setLoading(false)
    }
  }, [setupId])

  useEffect(() => {
    loadSetup()
  }, [loadSetup])

  // Fetch live wallet balance
  const fetchWalletBalance = useCallback(async () => {
    setWalletLoading(true)
    try {
      const res = await fetch("/api/onboarding/wallet-balance")
      const data = await res.json()
      if (res.ok) {
        setWalletBalance(data.balance)
      }
    } catch {
      // silent fail, show "unavailable"
    } finally {
      setWalletLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWalletBalance()
  }, [fetchWalletBalance])

  function goToStep(step: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("step", step)
    router.push(`/onboarding?${params.toString()}`)
  }

  // Purchase handler
  async function handlePurchase() {
    if (!setupId || !confirmed) return
    setPurchasing(true)

    try {
      const res = await fetch("/api/onboarding/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupId: Number(setupId) }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Purchase failed")
        setPurchasing(false)
        setConfirmOpen(false)
        return
      }

      toast.success("Purchase initiated! Provisioning has started.")
      setConfirmOpen(false)

      const params = new URLSearchParams(searchParams.toString())
      params.set("step", "provisioning")
      router.push(`/onboarding?${params.toString()}`)
    } catch {
      toast.error("Network error. Please try again.")
      setPurchasing(false)
    }
  }

  // Extract typed data from setup
  const personas: Persona[] = Array.isArray(setup?.persona_config)
    ? (setup.persona_config as unknown as Persona[])
    : []

  const domains: SelectedDomain[] = Array.isArray(setup?.selected_domains)
    ? (setup.selected_domains as unknown as SelectedDomain[])
    : []

  const domainCount = setup?.domain_count ?? 0
  const mailboxPerDomain = setup?.mailbox_per_domain ?? 2
  const totalMailboxes = setup?.total_mailboxes ?? 0
  const googleMailboxCount = setup?.google_mailbox_count ?? 0
  const microsoftMailboxCount = setup?.microsoft_mailbox_count ?? 0

  const googleDomainCount = Math.ceil(googleMailboxCount / mailboxPerDomain)
  const microsoftDomainCount = domainCount - googleDomainCount

  const DOMAIN_PRICE = 12.5
  const MAILBOX_PRICE = 2.99
  const domainCost = domainCount * DOMAIN_PRICE
  const mailboxCost = totalMailboxes * MAILBOX_PRICE
  const totalCost = domainCost + mailboxCost

  const hasSufficientBalance =
    walletBalance !== null && walletBalance >= totalCost
  const shortfall =
    walletBalance !== null ? Math.max(0, totalCost - walletBalance) : 0

  // Group domains by platform
  const googleDomains = domains.slice(0, googleDomainCount)
  const microsoftDomains = domains.slice(googleDomainCount)

  // Build full mailbox list — each domain gets 2 mailboxes: firstname@ + firstname.lastname@
  const allMailboxes = useMemo(() => {
    if (personas.length === 0 || domains.length === 0) return []

    const result: Array<{
      email: string
      persona: string
      personaIdx: number
      platform: string
      domain: string
      profilePic: string | null
    }> = []

    const sortedDomains = [
      ...googleDomains.map((d) => ({ ...d, platform: "Google" })),
      ...microsoftDomains.map((d) => ({ ...d, platform: "Microsoft" })),
    ]

    let pIdx = 0
    for (const domain of sortedDomains) {
      const p = personas[pIdx % personas.length]
      const first = p.first_name.toLowerCase()
      const last = p.last_name.toLowerCase()

      // Mailbox 1: firstname@domain
      result.push({
        email: `${first}@${domain.name}`,
        persona: `${p.first_name} ${p.last_name}`,
        personaIdx: pIdx % personas.length,
        platform: domain.platform,
        domain: domain.name,
        profilePic: p.profile_picture_url,
      })
      // Mailbox 2: firstname.lastname@domain
      result.push({
        email: `${first}.${last}@${domain.name}`,
        persona: `${p.first_name} ${p.last_name}`,
        personaIdx: pIdx % personas.length,
        platform: domain.platform,
        domain: domain.name,
        profilePic: p.profile_picture_url,
      })
      pIdx++
    }

    return result
  }, [personas, domains, googleDomains, microsoftDomains])

  // Per-persona mailbox counts
  const personaMailboxCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const mb of allMailboxes) {
      counts.set(mb.personaIdx, (counts.get(mb.personaIdx) ?? 0) + 1)
    }
    return counts
  }, [allMailboxes])

  if (!setupId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-500 mb-3" />
        <p className="text-sm text-muted-foreground">
          No setup ID found. Please start from the Client Info step.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !setup) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="h-8 w-8 text-red-500 mb-3" />
        <p className="text-sm text-red-600 dark:text-red-400">
          {error || "Setup not found"}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={loadSetup}
        >
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Review & Purchase
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review your configuration before purchasing. Domain purchases are
          non-refundable.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Client Info */}
        <div className="rounded-xl border border-stone-200 dark:border-stone-700 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Client</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => goToStep("client-info")}
            >
              <Pencil className="mr-1 h-3 w-3" />
              Edit
            </Button>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium text-foreground">
                {setup.display_name}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Slug</dt>
              <dd className="font-mono text-foreground">
                {setup.client_slug}
              </dd>
            </div>
            {setup.redirect_url && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Redirect URL</dt>
                <dd className="font-medium text-foreground truncate max-w-[200px]">
                  {setup.redirect_url}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Configuration */}
        <div className="rounded-xl border border-stone-200 dark:border-stone-700 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                Configuration
              </h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => goToStep("persona-config")}
            >
              <Pencil className="mr-1 h-3 w-3" />
              Edit
            </Button>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Mailboxes per domain</dt>
              <dd className="font-mono text-foreground text-xs">
                2 (firstname@ + firstname.lastname@)
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Google / Microsoft</dt>
              <dd className="font-medium text-foreground">
                {googleMailboxCount} / {microsoftMailboxCount}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Total mailboxes</dt>
              <dd className="font-medium text-foreground">{totalMailboxes}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Personas */}
      <div className="rounded-xl border border-stone-200 dark:border-stone-700 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Personas</h3>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {personas.length}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => goToStep("persona-config")}
          >
            <Pencil className="mr-1 h-3 w-3" />
            Edit
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {personas.map((p, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg bg-stone-50 dark:bg-stone-800 px-3 py-2"
            >
              <Avatar className="h-8 w-8">
                {p.profile_picture_url ? (
                  <AvatarImage
                    src={p.profile_picture_url}
                    alt={`${p.first_name} ${p.last_name}`}
                  />
                ) : null}
                <AvatarFallback className="bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-[10px] font-medium">
                  {getInitials(p.first_name, p.last_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {p.first_name} {p.last_name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {personaMailboxCounts.get(i) ?? 0} mailboxes
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Domains */}
      <div className="rounded-xl border border-stone-200 dark:border-stone-700 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Domains</h3>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {domainCount}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setDomainsExpanded(!domainsExpanded)}
            >
              {domainsExpanded ? (
                <ChevronUp className="mr-1 h-3 w-3" />
              ) : (
                <ChevronDown className="mr-1 h-3 w-3" />
              )}
              {domainsExpanded ? "Collapse" : "Expand"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => goToStep("domain-selection")}
            >
              <Pencil className="mr-1 h-3 w-3" />
              Edit
            </Button>
          </div>
        </div>

        {domainsExpanded && (
          <div className="space-y-3 max-h-[200px] overflow-y-auto">
            {googleDomains.length > 0 && (
              <div>
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                  Google ({googleDomains.length} domains)
                </p>
                <div className="flex flex-wrap gap-1">
                  {googleDomains.map((d) => (
                    <span
                      key={d.name}
                      className="inline-flex rounded-full bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 text-[10px] text-blue-700 dark:text-blue-300"
                    >
                      {d.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {microsoftDomains.length > 0 && (
              <div>
                <p className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-1">
                  Microsoft ({microsoftDomains.length} domains)
                </p>
                <div className="flex flex-wrap gap-1">
                  {microsoftDomains.map((d) => (
                    <span
                      key={d.name}
                      className="inline-flex rounded-full bg-orange-50 dark:bg-orange-950/30 px-2 py-0.5 text-[10px] text-orange-700 dark:text-orange-300"
                    >
                      {d.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!domainsExpanded && (
          <p className="text-xs text-muted-foreground">
            {googleDomains.length} Google + {microsoftDomains.length} Microsoft
            domains
          </p>
        )}
      </div>

      {/* Full Mailbox Preview */}
      {allMailboxes.length > 0 && (
        <div className="rounded-xl border border-stone-200 dark:border-stone-700 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Mailbox Preview
            </h3>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {allMailboxes.length} mailboxes across {domainCount} domains
            </Badge>
          </div>

          <div className="rounded-lg border border-stone-200 dark:border-stone-700 divide-y divide-stone-100 dark:divide-stone-800 overflow-hidden max-h-[400px] overflow-y-auto">
            {allMailboxes.map((mb, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 px-3 py-2 bg-white dark:bg-stone-900"
              >
                <Avatar className="h-5 w-5 shrink-0">
                  {mb.profilePic ? (
                    <AvatarImage src={mb.profilePic} alt={mb.persona} />
                  ) : null}
                  <AvatarFallback className="bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-[8px] font-medium">
                    {mb.persona
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-foreground font-mono flex-1 truncate">
                  {mb.email}
                </span>
                <div
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium shrink-0",
                    mb.platform === "Google"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      : "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                  )}
                >
                  <Monitor className="h-2 w-2" />
                  {mb.platform}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cost Breakdown + Wallet */}
      <div className="rounded-xl border border-stone-200 dark:border-stone-700 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            Cost Breakdown
          </h3>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              {domainCount} domain{domainCount !== 1 ? "s" : ""} x{" "}
              {fmtCurrency(DOMAIN_PRICE)}
            </span>
            <span className="font-medium text-foreground">
              {fmtCurrency(domainCost)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              {totalMailboxes} mailbox{totalMailboxes !== 1 ? "es" : ""} x{" "}
              {fmtCurrency(MAILBOX_PRICE)}
            </span>
            <span className="font-medium text-foreground">
              {fmtCurrency(mailboxCost)}
            </span>
          </div>
          <div className="border-t border-stone-200 dark:border-stone-700 pt-2 flex items-center justify-between">
            <span className="font-semibold text-foreground">Total</span>
            <span className="font-semibold text-foreground text-lg">
              {fmtCurrency(totalCost)}
            </span>
          </div>
        </div>

        {/* Live Wallet Balance */}
        <div className="border-t border-stone-200 dark:border-stone-700 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                InboxKit Wallet
              </span>
            </div>
            <button
              onClick={fetchWalletBalance}
              disabled={walletLoading}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw
                className={cn("h-3 w-3", walletLoading && "animate-spin")}
              />
              Refresh
            </button>
          </div>

          {walletLoading && walletBalance === null ? (
            <div className="h-6 w-24 rounded bg-stone-200 dark:bg-stone-700 animate-pulse" />
          ) : walletBalance !== null ? (
            <div className="space-y-2">
              <p className="text-lg font-semibold text-foreground">
                {fmtCurrency(walletBalance)}
              </p>

              {hasSufficientBalance ? (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 py-2">
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    Ready to purchase
                  </span>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 ml-auto">
                    {fmtCurrency(walletBalance - totalCost)} remaining after
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium text-red-600 dark:text-red-300">
                      Insufficient balance — add {fmtCurrency(shortfall)}
                    </span>
                  </div>
                  <a
                    href="https://app.inboxkit.com/billing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Top up at InboxKit billing dashboard
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Unable to fetch wallet balance
            </p>
          )}
        </div>
      </div>

      {/* Purchase Button */}
      <Button
        size="lg"
        className="w-full"
        onClick={() => setConfirmOpen(true)}
        disabled={purchasing || !hasSufficientBalance}
      >
        {!hasSufficientBalance && walletBalance !== null
          ? "Insufficient Balance — Top Up to Purchase"
          : "Purchase & Start Provisioning"}
      </Button>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
            <DialogDescription>
              You are about to purchase domains and provision mailboxes for{" "}
              <span className="font-medium text-foreground">
                {setup.display_name}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Domains</span>
                <span className="font-medium">{domainCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mailboxes</span>
                <span className="font-medium">{totalMailboxes}</span>
              </div>
              <div className="border-t border-stone-200 dark:border-stone-700 pt-2 flex justify-between">
                <span className="font-semibold">Total cost</span>
                <span className="font-semibold">{fmtCurrency(totalCost)}</span>
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Domain purchases are non-refundable. Please verify your
                  configuration before proceeding.
                </p>
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={confirmed}
                onCheckedChange={(val) => setConfirmed(val === true)}
                className="mt-0.5"
              />
              <span className="text-sm text-foreground leading-tight">
                I confirm this order and understand that domain purchases are
                non-refundable.
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmOpen(false)
                setConfirmed(false)
              }}
              disabled={purchasing}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePurchase}
              disabled={!confirmed || purchasing}
            >
              {purchasing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Confirm Purchase
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
