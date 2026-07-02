"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import {
  Loader2,
  Check,
  X,
  Globe,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Wallet,
  Calculator,
  Sparkles,
  Shield,
  Search,
  CheckCheck,
  XCircle,
  PlusCircle,
  StopCircle,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// ---------- Helpers ----------

function fmtCurrency(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  })
}

// ---------- Types ----------

interface AvailableDomain {
  name: string
  price: number
  available: boolean
  google_workspace_available?: boolean
  ms365_workspace_available?: boolean
}

type GenerationPhase =
  | "idle"
  | "research"
  | "generate"
  | "availability"
  | "workspace"
  | "complete"
  | "error"

interface PhaseState {
  phase: GenerationPhase
  message: string
  description?: string
}

const PHASE_CONFIG: Record<
  string,
  { icon: typeof Globe; label: string; description: string }
> = {
  research: {
    icon: Globe,
    label: "Researching Company",
    description: "Analyzing the company website to understand the business",
  },
  generate: {
    icon: Sparkles,
    label: "Generating Domains",
    description: "Using AI to create brand-relevant domain suggestions",
  },
  availability: {
    icon: Search,
    label: "Checking Availability",
    description: "Verifying each domain is available for registration",
  },
  workspace: {
    icon: Shield,
    label: "Verifying Workspaces",
    description: "Checking Google & Microsoft email compatibility",
  },
}

const PHASE_ORDER: GenerationPhase[] = [
  "research",
  "generate",
  "availability",
  "workspace",
]

// ---------- Component ----------

interface DomainSelectionStepProps {
  onInsufficientBalanceChange?: (insufficient: boolean) => void
}

export function DomainSelectionStep({
  onInsufficientBalanceChange,
}: DomainSelectionStepProps) {
  const searchParams = useSearchParams()
  const setupId = searchParams.get("setupId")

  // Generation state
  const [phaseState, setPhaseState] = useState<PhaseState>({
    phase: "idle",
    message: "",
  })
  const [domains, setDomains] = useState<AvailableDomain[]>([])
  const [generating, setGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const hasAutoStarted = useRef(false)
  const appendModeRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  // Independent phase tracking for concurrent pipeline
  const [completedPhases, setCompletedPhases] = useState<Set<string>>(
    new Set()
  )
  const [availabilityProgress, setAvailabilityProgress] = useState({
    checked: 0,
    total: 0,
    available: 0,
  })
  const [workspaceProgress, setWorkspaceProgress] = useState({
    checked: 0,
    total: 0,
  })

  // Stall banner
  const [showStallBanner, setShowStallBanner] = useState(false)

  // Selection state
  const [selected, setSelected] = useState<Map<string, AvailableDomain>>(
    new Map()
  )

  // Save state
  const [saving, setSaving] = useState(false)

  // Wallet balance state
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [walletLoading, setWalletLoading] = useState(false)
  const [walletError, setWalletError] = useState<string | null>(null)

  // Domain count from setup
  const [targetDomainCount, setTargetDomainCount] = useState(50)
  const [setupLoaded, setSetupLoaded] = useState(false)

  // Abort on unmount
  useEffect(() => () => { abortRef.current?.abort() }, [])

  // Load domain_count + previously saved domains from setup
  useEffect(() => {
    if (!setupId) return
    async function loadSetup() {
      try {
        const res = await fetch(`/api/onboarding/get-setup?id=${setupId}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.setup?.domain_count) {
          setTargetDomainCount(data.setup.domain_count)
        }

        // Restore previously saved domains + selection
        if (
          Array.isArray(data.setup?.selected_domains) &&
          data.setup.selected_domains.length > 0
        ) {
          const savedDomains: AvailableDomain[] =
            data.setup.selected_domains.map(
              (d: { name: string; price: number; google_workspace_available?: boolean; ms365_workspace_available?: boolean }) => ({
                name: d.name,
                price: d.price ?? 9,
                available: true,
                google_workspace_available: d.google_workspace_available ?? true,
                ms365_workspace_available: d.ms365_workspace_available ?? true,
              })
            )
          setDomains(savedDomains)
          setSelected(new Map(savedDomains.map((d) => [d.name, d])))
          setPhaseState({
            phase: "complete",
            message: `${savedDomains.length} saved domains loaded`,
          })
          setCompletedPhases(
            new Set(["research", "generate", "availability", "workspace"])
          )
        }
      } catch {
        // use default
      } finally {
        setSetupLoaded(true)
      }
    }
    loadSetup()
  }, [setupId])

  const selectedCount = selected.size
  const CORE_TARGET = targetDomainCount
  const EXTRA_TARGET = Math.ceil(targetDomainCount * 0.5)

  // Cost calculation
  const DOMAIN_PRICE = 12.5
  const MAILBOX_PRICE = 2.99
  const MAILBOXES_PER_DOMAIN = 2
  const domainCost = selectedCount * DOMAIN_PRICE
  const mailboxCount = selectedCount * MAILBOXES_PER_DOMAIN
  const mailboxCost = mailboxCount * MAILBOX_PRICE
  const totalCost = domainCost + mailboxCost
  const hasSufficientBalance =
    walletBalance !== null && walletBalance >= totalCost
  const shortfall =
    walletBalance !== null ? Math.max(0, totalCost - walletBalance) : 0

  // ---------- Wallet Balance ----------

  const fetchWalletBalance = useCallback(async () => {
    setWalletLoading(true)
    setWalletError(null)
    try {
      const res = await fetch("/api/onboarding/wallet-balance")
      const data = await res.json()
      if (!res.ok) {
        setWalletError(data.error || "Failed to fetch balance")
        return
      }
      setWalletBalance(data.balance)
    } catch {
      setWalletError("Network error fetching balance")
    } finally {
      setWalletLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWalletBalance()
  }, [fetchWalletBalance])

  // Notify parent — only block Next when no domains are selected
  useEffect(() => {
    if (!onInsufficientBalanceChange) return
    onInsufficientBalanceChange(selectedCount === 0)
  }, [selectedCount, onInsufficientBalanceChange])

  // ---------- Stop & use what we have ----------

  const stopAndKeep = useCallback(() => {
    abortRef.current?.abort()
    setGenerating(false)
    setShowStallBanner(false)
    if (domains.length > 0) {
      setPhaseState({
        phase: "complete",
        message: `Stopped early — ${domains.length} domains available`,
      })
      setCompletedPhases(
        new Set(["research", "generate", "availability", "workspace"])
      )
    }
  }, [domains.length])

  // ---------- SSE Domain Generation ----------

  const startGeneration = useCallback(
    async (append: boolean = false) => {
      if (!setupId || generating) return

      // Abort any previous generation
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac

      appendModeRef.current = append

      setGenerating(true)
      setGenerationError(null)
      setShowStallBanner(false)

      // Reset phase tracking
      setCompletedPhases(new Set())
      setAvailabilityProgress({ checked: 0, total: 0, available: 0 })
      setWorkspaceProgress({ checked: 0, total: 0 })

      if (!append) {
        setDomains([])
        setSelected(new Map())
      }

      setPhaseState({ phase: "research", message: "Starting..." })

      // Track existing domain names for dedup in append mode
      const existingNames = append
        ? new Set(domains.map((d) => d.name))
        : new Set<string>()

      const STALL_MS = 15_000
      let stallTimer: ReturnType<typeof setTimeout> | undefined

      function resetStallTimer() {
        clearTimeout(stallTimer)
        setShowStallBanner(false)
        stallTimer = setTimeout(() => {
          setShowStallBanner(true)
        }, STALL_MS)
      }

      try {
        resetStallTimer()

        const res = await fetch("/api/onboarding/search-domains", {
          method: "POST",
          signal: ac.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ setupId: Number(setupId) }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "Failed to start domain generation")
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error("No response stream")

        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          resetStallTimer() // Got data, reset stall

          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const jsonStr = line.slice(6).trim()
            if (!jsonStr) continue

            try {
              const event = JSON.parse(jsonStr)
              handleSSEEvent(event, existingNames, append)
            } catch {
              // Skip malformed events
            }
          }
        }

        // Process remaining buffer
        if (buffer.startsWith("data: ")) {
          try {
            const event = JSON.parse(buffer.slice(6).trim())
            handleSSEEvent(event, existingNames, append)
          } catch {
            // Skip
          }
        }

        // Stream ended without a "complete" event — treat as partial success
        // This happens when Vercel timeout kills the serverless function
        if (phaseState.phase !== "complete" && phaseState.phase !== "error") {
          setDomains((currentDomains) => {
            if (currentDomains.length > 0) {
              setPhaseState({
                phase: "complete",
                message: `Found ${currentDomains.length} domains (search ended early)`,
              })
              setCompletedPhases(
                new Set(["research", "generate", "availability", "workspace"])
              )
            }
            return currentDomains
          })
        }
      } catch (err) {
        // Intentional abort — don't show error
        if (err instanceof DOMException && err.name === "AbortError") return

        // Preserve found domains — show error banner above results
        setGenerationError(
          err instanceof Error ? err.message : "Domain generation failed"
        )
        setPhaseState({
          phase: "error",
          message: err instanceof Error ? err.message : "Generation failed",
        })
        toast.error("Domain generation failed")
        // Do NOT clear domains or selected — keep what we found
      } finally {
        clearTimeout(stallTimer)
        setShowStallBanner(false)
        setGenerating(false)
      }
    },
    [setupId, generating, domains]
  )

  function handleSSEEvent(
    event: Record<string, unknown>,
    existingNames: Set<string>,
    append: boolean
  ) {
    const phase = event.phase as string

    if (phase === "domain_found") {
      const domain = event.domain as AvailableDomain
      // In append mode, skip domains we already have
      if (append && existingNames.has(domain.name)) return
      existingNames.add(domain.name)
      setDomains((prev) => [...prev, domain])
      return
    }

    if (phase === "complete") {
      const finalDomains = (event.domains ?? []) as AvailableDomain[]
      const recommended = (event.recommended ?? []) as string[]

      if (append) {
        // Merge new domains, deduplicating
        setDomains((prev) => {
          const existing = new Set(prev.map((d) => d.name))
          const newOnes = finalDomains.filter((d) => !existing.has(d.name))
          return [...prev, ...newOnes]
        })
        // Don't auto-select in append mode
      } else {
        if (finalDomains.length > 0) {
          setDomains(finalDomains)
        }
        // Auto-select recommended domains
        if (recommended.length > 0) {
          const recommendedSet = new Set(recommended)
          setSelected(() => {
            const sel = new Map<string, AvailableDomain>()
            for (const d of finalDomains) {
              if (
                recommendedSet.has(d.name) &&
                d.available &&
                d.google_workspace_available !== false &&
                d.ms365_workspace_available !== false
              ) {
                sel.set(d.name, d)
              }
            }
            return sel
          })
        }
      }

      setCompletedPhases(
        new Set(["research", "generate", "availability", "workspace"])
      )
      setPhaseState({
        phase: "complete",
        message: event.message as string,
      })
      return
    }

    if (phase === "error") {
      setGenerationError(event.message as string)
      setPhaseState({
        phase: "error",
        message: event.message as string,
      })
      return
    }

    // Track phase completion based on transitions
    if (phase === "generate") {
      setCompletedPhases((prev) => new Set([...prev, "research"]))
    }
    if (phase === "availability") {
      setCompletedPhases((prev) => new Set([...prev, "research", "generate"]))
      setAvailabilityProgress({
        checked: (event.checked as number) ?? 0,
        total: (event.total as number) ?? 0,
        available: (event.available as number) ?? 0,
      })
    }
    if (phase === "workspace") {
      setCompletedPhases((prev) =>
        new Set([...prev, "research", "generate", "availability"])
      )
      setWorkspaceProgress({
        checked: (event.checked as number) ?? 0,
        total: (event.total as number) ?? 0,
      })
    }

    setPhaseState({
      phase: phase as GenerationPhase,
      message: (event.message as string) ?? "",
      description: event.description as string | undefined,
    })
  }

  // Auto-start generation on mount (after setup is loaded) — ONCE only
  useEffect(() => {
    if (setupId && setupLoaded && !hasAutoStarted.current && !generating && domains.length === 0) {
      hasAutoStarted.current = true
      startGeneration(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupId, setupLoaded])

  // ---------- Selection ----------

  function isSelectable(d: AvailableDomain) {
    return (
      d.available &&
      d.google_workspace_available === true &&
      d.ms365_workspace_available === true
    )
  }

  function toggleDomain(d: AvailableDomain) {
    if (!isSelectable(d)) return
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(d.name)) {
        next.delete(d.name)
      } else {
        next.set(d.name, d)
      }
      return next
    })
  }

  function selectAllAvailable() {
    setSelected((prev) => {
      const next = new Map(prev)
      for (const d of domains) {
        if (isSelectable(d) && !next.has(d.name)) {
          next.set(d.name, d)
        }
      }
      return next
    })
  }

  function deselectAll() {
    setSelected(new Map())
  }

  function removeDomain(name: string) {
    setSelected((prev) => {
      const next = new Map(prev)
      next.delete(name)
      return next
    })
  }

  // ---------- Save ----------

  async function handleSave() {
    if (!setupId || selectedCount === 0) return
    setSaving(true)

    try {
      const selectedArr = Array.from(selected.values()).map((d) => ({
        name: d.name,
        tld: ".com",
        price: d.price,
        google_workspace_available: d.google_workspace_available,
        ms365_workspace_available: d.ms365_workspace_available,
      }))

      const res = await fetch("/api/onboarding/update-setup", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setupId: Number(setupId),
          selected_domains: selectedArr,
          domain_count: selectedCount,
          estimated_cost_usd: totalCost,
          wallet_balance_usd: walletBalance,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Failed to save domains")
        return
      }

      toast.success(
        `${selectedCount} domain${selectedCount !== 1 ? "s" : ""} saved`
      )
    } catch {
      toast.error("Failed to save — check your connection")
    } finally {
      setSaving(false)
    }
  }

  // ---------- Progress bars ----------

  const coreProgress = Math.min(selectedCount, CORE_TARGET)
  const extraProgress = Math.max(
    0,
    Math.min(selectedCount - CORE_TARGET, EXTRA_TARGET)
  )
  const corePct = (coreProgress / CORE_TARGET) * 100
  const extraPct = (extraProgress / EXTRA_TARGET) * 100

  // ---------- Render ----------

  if (!setupId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="h-8 w-8 text-amber-500 mb-3" />
        <p className="text-sm text-muted-foreground">
          No setup ID found. Please start from the Client Info step.
        </p>
      </div>
    )
  }

  const isGenerating = generating || phaseState.phase === "idle"
  const showResults = domains.length > 0 || phaseState.phase === "complete"
  const hasError = phaseState.phase === "error"

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Left: Generation Progress + Results */}
      <div className="flex-1 min-w-0 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Domain Selection
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-powered domain suggestions based on your client&apos;s brand and
            industry. Only .com domains with Google & Microsoft workspace
            support.
          </p>
        </div>

        {/* Phase Progress Card */}
        {(isGenerating || hasError) && (
          <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950">
                  <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {appendModeRef.current
                      ? "Generating More Domains"
                      : "Generating Domains"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {phaseState.message}
                  </p>
                </div>
              </div>

              {/* Stop button while generating */}
              {generating && domains.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={stopAndKeep}
                  className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-950/30"
                >
                  <StopCircle className="mr-1.5 h-3.5 w-3.5" />
                  Stop & use {domains.length} found
                </Button>
              )}
            </div>

            {/* Stall Banner */}
            {showStallBanner && generating && (
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-amber-700 dark:text-amber-300">
                    Search is taking longer than expected...
                  </span>
                </div>
                {domains.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={stopAndKeep}
                    className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:text-amber-400"
                  >
                    Stop & use what we have
                  </Button>
                )}
              </div>
            )}

            {/* Phase Steps */}
            <div className="space-y-3 pl-1">
              {PHASE_ORDER.map((phaseName) => {
                const config = PHASE_CONFIG[phaseName]
                const Icon = config.icon

                const isComplete = completedPhases.has(phaseName)
                const isActive =
                  !isComplete &&
                  (phaseName === phaseState.phase ||
                    (phaseName === "availability" &&
                      availabilityProgress.total > 0 &&
                      !completedPhases.has("availability")) ||
                    (phaseName === "workspace" &&
                      workspaceProgress.total > 0 &&
                      !completedPhases.has("workspace")))
                const isPending = !isComplete && !isActive

                // Get progress for this specific phase
                const phaseChecked =
                  phaseName === "availability"
                    ? availabilityProgress.checked
                    : phaseName === "workspace"
                      ? workspaceProgress.checked
                      : 0
                const phaseTotal =
                  phaseName === "availability"
                    ? availabilityProgress.total
                    : phaseName === "workspace"
                      ? workspaceProgress.total
                      : 0

                return (
                  <div key={phaseName} className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all",
                        isComplete &&
                          "border-emerald-500 bg-emerald-500 text-white",
                        isActive &&
                          "border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400",
                        isPending &&
                          "border-stone-200 dark:border-stone-700 text-stone-400"
                      )}
                    >
                      {isComplete ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : isActive ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Icon className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          isActive && "text-foreground",
                          isComplete &&
                            "text-emerald-600 dark:text-emerald-400",
                          isPending && "text-muted-foreground"
                        )}
                      >
                        {config.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {(isActive || isComplete) &&
                        phaseName === "availability" &&
                        availabilityProgress.total > 0
                          ? `Checked ${availabilityProgress.checked} of ${availabilityProgress.total} — ${availabilityProgress.available} available`
                          : (isActive || isComplete) &&
                              phaseName === "workspace" &&
                              workspaceProgress.total > 0
                            ? `Verified ${workspaceProgress.checked} of ${workspaceProgress.total} domains`
                            : config.description}
                      </p>

                      {/* Progress bar for availability & workspace */}
                      {(isActive || isComplete) &&
                        (phaseName === "availability" ||
                          phaseName === "workspace") &&
                        phaseTotal > 0 && (
                          <div className="mt-2 h-2 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-300",
                                isComplete ? "bg-emerald-500" : "bg-indigo-500"
                              )}
                              style={{
                                width: `${(phaseChecked / phaseTotal) * 100}%`,
                              }}
                            />
                          </div>
                        )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Error state — shows above results, never clears found domains */}
            {hasError && (
              <div className="rounded-md bg-red-50 dark:bg-red-950/30 p-3 space-y-2">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {domains.length > 0
                    ? `Search interrupted — ${domains.length} domains found. You can select from these or retry.`
                    : generationError || "An error occurred"}
                </p>
                <div className="flex items-center gap-2">
                  {domains.length > 0 ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          hasAutoStarted.current = false
                          startGeneration(true) // Append mode — don't wipe existing
                        }}
                      >
                        <RefreshCw className="mr-2 h-3 w-3" />
                        Retry
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          hasAutoStarted.current = false
                          startGeneration(false) // Fresh start
                        }}
                        className="text-muted-foreground"
                      >
                        <RotateCcw className="mr-2 h-3 w-3" />
                        Start Over
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        hasAutoStarted.current = false
                        startGeneration(false)
                      }}
                    >
                      <RefreshCw className="mr-2 h-3 w-3" />
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Completion summary + Regenerate + Generate More */}
        {phaseState.phase === "complete" && !generating && (
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                Found {domains.length} available domains
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  hasAutoStarted.current = false
                  startGeneration(true)
                }}
              >
                <PlusCircle className="mr-2 h-3 w-3" />
                Generate More
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  hasAutoStarted.current = false
                  startGeneration(false)
                }}
              >
                <RefreshCw className="mr-2 h-3 w-3" />
                Regenerate
              </Button>
            </div>
          </div>
        )}

        {/* Bulk actions */}
        {showResults && domains.length > 0 && (
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={selectAllAvailable}>
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deselectAll}
              disabled={selectedCount === 0}
            >
              <XCircle className="mr-1.5 h-3.5 w-3.5" />
              Deselect All
            </Button>
            <span className="text-xs text-muted-foreground ml-auto">
              {domains.filter(isSelectable).length} selectable of{" "}
              {domains.length} domains
            </span>
          </div>
        )}

        {/* Results grid */}
        {domains.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {domains.map((d) => {
              const selectable = isSelectable(d)
              const isSelected = selected.has(d.name)

              return (
                <button
                  key={d.name}
                  onClick={() => toggleDomain(d)}
                  disabled={!selectable}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition-all duration-150",
                    selectable &&
                      !isSelected &&
                      "border-stone-200 dark:border-stone-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 cursor-pointer",
                    isSelected &&
                      "border-indigo-400 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 ring-1 ring-indigo-200 dark:ring-indigo-800 shadow-sm",
                    !selectable &&
                      "border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 opacity-50 cursor-not-allowed"
                  )}
                >
                  {/* Checkbox */}
                  <div
                    className={cn(
                      "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border transition-all",
                      isSelected
                        ? "border-indigo-500 bg-indigo-500 text-white"
                        : "border-stone-300 dark:border-stone-600",
                      !selectable && "border-stone-200 dark:border-stone-700"
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>

                  {/* Domain info */}
                  <div className="flex-1 min-w-0">
                    <span
                      className={cn(
                        "text-sm font-medium truncate block",
                        selectable ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {d.name}
                    </span>
                    {!selectable && (
                      <span className="text-[10px] text-muted-foreground">
                        {d.google_workspace_available === false &&
                        d.ms365_workspace_available === false
                          ? "No workspace support"
                          : d.google_workspace_available === false
                            ? "No Google Workspace"
                            : "No Microsoft 365"}
                      </span>
                    )}
                  </div>

                  {/* Price */}
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    ${d.price}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Empty state during idle/before results */}
        {!generating &&
          phaseState.phase === "idle" &&
          domains.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Globe className="h-10 w-10 text-stone-300 dark:text-stone-600 mb-3" />
              <p className="text-sm text-muted-foreground">
                Domain generation will start automatically.
              </p>
            </div>
          )}
      </div>

      {/* Right: Selected Domains Panel */}
      <div className="w-full lg:w-72 shrink-0 space-y-4 lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-900/50 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Selected Domains
            </h3>
            <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
              {selectedCount}
            </span>
          </div>

          {/* Progress bars */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Core</span>
                <span className="text-xs font-medium text-foreground">
                  {coreProgress}/{CORE_TARGET}
                </span>
              </div>
              <div className="h-2 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    corePct >= 100 ? "bg-emerald-500" : "bg-indigo-500"
                  )}
                  style={{ width: `${Math.min(corePct, 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Extra</span>
                <span className="text-xs font-medium text-foreground">
                  {extraProgress}/{EXTRA_TARGET}
                </span>
              </div>
              <div className="h-2 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    extraPct >= 100 ? "bg-emerald-500" : "bg-amber-500"
                  )}
                  style={{ width: `${Math.min(extraPct, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Selected list */}
          {selectedCount > 0 ? (
            <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
              {Array.from(selected.values())
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((d) => (
                  <div
                    key={d.name}
                    className="group flex items-center justify-between rounded px-2 py-1 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                  >
                    <span className="text-xs text-foreground truncate">
                      {d.name}
                    </span>
                    <button
                      onClick={() => removeDomain(d.name)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-stone-200 dark:hover:bg-stone-700"
                    >
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">
              No domains selected yet.
            </p>
          )}

          {/* Save button */}
          <Button
            onClick={handleSave}
            disabled={saving || selectedCount === 0}
            className="w-full"
            size="sm"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Saving...
              </>
            ) : (
              `Save ${selectedCount} Domain${selectedCount !== 1 ? "s" : ""}`
            )}
          </Button>
        </div>

        {/* Cost Calculator */}
        <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-900/50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Cost Breakdown
            </h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {selectedCount} domain{selectedCount !== 1 ? "s" : ""} x{" "}
                {fmtCurrency(DOMAIN_PRICE)}
              </span>
              <span className="font-medium text-foreground">
                {fmtCurrency(domainCost)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {mailboxCount} mailbox{mailboxCount !== 1 ? "es" : ""} x{" "}
                {fmtCurrency(MAILBOX_PRICE)}
              </span>
              <span className="font-medium text-foreground">
                {fmtCurrency(mailboxCost)}
              </span>
            </div>
            <div className="border-t border-stone-200 dark:border-stone-700 pt-2 flex items-center justify-between">
              <span className="font-semibold text-foreground">Total</span>
              <span className="font-semibold text-foreground">
                {fmtCurrency(totalCost)}
              </span>
            </div>
          </div>

          {/* Wallet Balance */}
          <div className="border-t border-stone-200 dark:border-stone-700 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Wallet Balance
                </span>
              </div>
              <button
                onClick={fetchWalletBalance}
                disabled={walletLoading}
                className="p-0.5 rounded hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                title="Refresh balance"
              >
                <RefreshCw
                  className={cn(
                    "h-3 w-3 text-muted-foreground",
                    walletLoading && "animate-spin"
                  )}
                />
              </button>
            </div>

            {walletError ? (
              <p className="text-[11px] text-red-500">{walletError}</p>
            ) : walletBalance !== null ? (
              <p className="text-sm font-semibold text-foreground">
                {fmtCurrency(walletBalance)}
              </p>
            ) : walletLoading ? (
              <div className="h-5 w-20 rounded bg-stone-200 dark:bg-stone-700 animate-pulse" />
            ) : null}

            {/* Balance status badge */}
            {selectedCount > 0 && walletBalance !== null && (
              <>
                {hasSufficientBalance ? (
                  <div className="flex items-center gap-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1.5">
                    <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                      Sufficient balance
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 rounded-md bg-red-50 dark:bg-red-950/30 px-2 py-1.5">
                      <AlertCircle className="h-3 w-3 text-red-500 dark:text-red-400" />
                      <span className="text-[11px] font-medium text-red-600 dark:text-red-300">
                        Insufficient — need {fmtCurrency(shortfall)} more
                      </span>
                    </div>
                    <a
                      href="https://app.inboxkit.com/billing"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Top up at InboxKit billing dashboard
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
