"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { Loader2, AlertTriangle, X, Check, ChevronRight, Settings } from "lucide-react"
import { toast } from "sonner"

const MAILBOX_COST = 2.99

const PERSONA_DEFAULTS: Record<
  string,
  { first_name: string; last_name: string; profile_picture_url: string }
> = {
  omar: {
    first_name: "Omar",
    last_name: "Almubarak",
    profile_picture_url:
      "https://uivgowblojtyiobhgjlv.supabase.co/storage/v1/object/public/profile-pictures/omar-almubarak.jpeg",
  },
  josh: {
    first_name: "Josh",
    last_name: "Arnold",
    profile_picture_url:
      "https://spaces-us-1.nyc3.cdn.digitaloceanspaces.com/inboxkit/9450199da14f4d2f906716ca06f6b5d4.jpeg",
  },
  james: {
    first_name: "James",
    last_name: "Ford",
    profile_picture_url:
      "https://spaces-us-1.nyc3.cdn.digitaloceanspaces.com/inboxkit/7b702a5c99004626b523292d28259a7a.jpeg",
  },
  eve: {
    first_name: "Eve",
    last_name: "Kelly",
    profile_picture_url:
      "https://uivgowblojtyiobhgjlv.supabase.co/storage/v1/object/public/profile-pictures/eve-kelly.jpeg",
  },
  jonathan: {
    first_name: "Jonathan",
    last_name: "Claydon",
    profile_picture_url:
      "https://uivgowblojtyiobhgjlv.supabase.co/storage/v1/object/public/profile-pictures/jonathan.jpeg",
  },
}

interface Domain {
  id: number
  domain_name: string
  registration_price: number
  google_workspace_available: boolean
  ms365_workspace_available: boolean
}

const CLIENT_REDIRECT_URLS: Record<string, string> = {
  omnivate: "https://omnivate.ai",
  roosterpunk: "https://roosterpunk.com",
  cylindo: "https://cylindo.com",
  paycaptain: "https://www.paycaptain.com",
  acceleration_partners: "https://www.accelerationpartners.com",
}

interface OrderMailboxesModalProps {
  client: string
  open: boolean
  onOpenChange: (open: boolean) => void
  domains: Domain[]
  personas: string[]
  onOrderComplete?: () => void
}

interface PersonaDetails {
  first_name: string
  last_name: string
  profile_picture_url: string
}

type PlatformMode = "all_google" | "all_microsoft" | "per_persona" | "mixed"

export function OrderMailboxesModal({
  client,
  open,
  onOpenChange,
  domains: initialDomains,
  personas,
  onOrderComplete,
}: OrderMailboxesModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [submitting, setSubmitting] = useState(false)

  // Domain list (can remove individual domains)
  const [domains, setDomains] = useState<Domain[]>([])

  // Persona split — count for first persona, rest go to second
  const [firstPersonaCount, setFirstPersonaCount] = useState(0)

  // Platform
  const [platformMode, setPlatformMode] = useState<PlatformMode>("all_google")
  const [personaPlatforms, setPersonaPlatforms] = useState<Record<string, "google" | "microsoft">>({})
  const [googleCount, setGoogleCount] = useState(0) // for mixed mode

  // Persona details (pre-filled)
  const [personaDetails, setPersonaDetails] = useState<Record<string, PersonaDetails>>({})

  // Advanced
  const [redirectUrl, setRedirectUrl] = useState(CLIENT_REDIRECT_URLS[client] ?? `https://${client}.com`)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  // Collapsible persona details
  const [detailsOpen, setDetailsOpen] = useState(false)

  // Re-initialize when domains prop changes (modal opens)
  useEffect(() => {
    const sorted = [...initialDomains].sort((a, b) =>
      a.domain_name.localeCompare(b.domain_name)
    )
    setDomains(sorted)

    // Default split: all to first persona if only 1, else ~50/50
    const firstCount = personas.length >= 2 ? Math.ceil(sorted.length / 2) : sorted.length
    setFirstPersonaCount(firstCount)

    // Default platform per persona
    const pp: Record<string, "google" | "microsoft"> = {}
    for (const p of personas) pp[p] = "google"
    setPersonaPlatforms(pp)
    setPlatformMode("all_google")
    setGoogleCount(Math.ceil(sorted.length / 2))

    // Pre-fill persona details
    const details: Record<string, PersonaDetails> = {}
    for (const p of personas) {
      const defaults = PERSONA_DEFAULTS[p]
      details[p] = {
        first_name: defaults?.first_name ?? p.charAt(0).toUpperCase() + p.slice(1),
        last_name: defaults?.last_name ?? "",
        profile_picture_url: defaults?.profile_picture_url ?? "",
      }
    }
    setPersonaDetails(details)

    setStep(1)
    setAdvancedOpen(false)
    // Auto-open persona details if any persona is missing last_name or profile_picture_url
    const hasIncomplete = personas.some((p) => {
      const d = PERSONA_DEFAULTS[p]
      return !d?.last_name || !d?.profile_picture_url
    })
    setDetailsOpen(hasIncomplete)
  }, [initialDomains, personas, client])

  // Derived: persona assignments
  // Single-persona clients always get ALL domains (ignore firstPersonaCount).
  // Multi-persona clients split based on firstPersonaCount.
  const personaAssignments = useMemo(() => {
    const first = personas[0]
    const second = personas[1]

    if (!second) {
      // Single persona — assign everything to first
      return {
        first,
        second: undefined,
        firstDomains: domains,
        secondDomains: [] as Domain[],
        clampedCount: domains.length,
      }
    }

    const clampedCount = Math.max(0, Math.min(firstPersonaCount, domains.length))
    const firstDomains = domains.slice(0, clampedCount)
    const secondDomains = domains.slice(clampedCount)

    return { first, second, firstDomains, secondDomains, clampedCount }
  }, [domains, personas, firstPersonaCount])

  // Derived: get platform for a persona (used for all_google, all_microsoft, per_persona)
  const getPersonaPlatform = useCallback(
    (persona: string): "google" | "microsoft" => {
      if (platformMode === "all_google") return "google"
      if (platformMode === "all_microsoft") return "microsoft"
      return personaPlatforms[persona] ?? "google"
    },
    [platformMode, personaPlatforms]
  )

  // Derived: get platform for a specific domain by its overall index
  // In mixed mode, first googleCount domains = Google, rest = Microsoft
  const getDomainPlatform = useCallback(
    (domainIndex: number, persona: string): "google" | "microsoft" => {
      if (platformMode === "mixed") {
        return domainIndex < googleCount ? "google" : "microsoft"
      }
      return getPersonaPlatform(persona)
    },
    [platformMode, googleCount, getPersonaPlatform]
  )

  // Derived: platform summary for display
  const platformSummary = useMemo(() => {
    if (platformMode === "all_google") return "Google"
    if (platformMode === "all_microsoft") return "Microsoft"
    if (platformMode === "mixed") {
      const msCount = domains.length - googleCount
      return `${googleCount} Google, ${msCount} Microsoft`
    }
    return "Per persona"
  }, [platformMode, googleCount, domains.length])

  // Derived: cost
  const costBreakdown = useMemo(() => {
    const domainCount = domains.length
    const totalDomainCost = domains.reduce((sum, d) => sum + (d.registration_price ?? 0), 0)
    const mailboxCount = domainCount * 2
    const totalMailboxCost = mailboxCount * MAILBOX_COST
    const total = totalDomainCost + totalMailboxCost
    return { domainCount, totalDomainCost, mailboxCount, totalMailboxCost, total }
  }, [domains])

  // Active personas (ones that have domains assigned)
  const activePersonas = useMemo(() => {
    const result: string[] = []
    if (personaAssignments.firstDomains.length > 0) result.push(personaAssignments.first)
    if (personaAssignments.second && personaAssignments.secondDomains.length > 0)
      result.push(personaAssignments.second)
    return result
  }, [personaAssignments])

  function removeDomain(domainId: number) {
    setDomains((prev) => {
      const next = prev.filter((d) => d.id !== domainId)
      // Adjust split if it now exceeds domain count
      setFirstPersonaCount((c) => Math.min(c, next.length))
      return next
    })
  }

  function handleSplitChange(value: number) {
    const clamped = Math.max(0, Math.min(value, domains.length))
    setFirstPersonaCount(clamped)
  }

  function updatePersonaDetail(persona: string, field: keyof PersonaDetails, value: string) {
    setPersonaDetails((prev) => ({
      ...prev,
      [persona]: { ...prev[persona], [field]: value },
    }))
  }

  function handleNext() {
    if (domains.length === 0) {
      toast.error("Add at least one domain to proceed")
      return
    }
    setStep(2)
  }

  async function handleConfirm() {
    setSubmitting(true)
    try {
      // Build the flat domain array expected by the API
      // Index tracks position across all domains for mixed platform assignment
      let idx = 0
      const domainPayload = [
        ...personaAssignments.firstDomains.map((d) => ({
          domain_id: d.id,
          domain_name: d.domain_name,
          persona: personaAssignments.first,
          platform: getDomainPlatform(idx++, personaAssignments.first),
          registration_price: d.registration_price,
        })),
        ...personaAssignments.secondDomains.map((d) => ({
          domain_id: d.id,
          domain_name: d.domain_name,
          persona: personaAssignments.second!,
          platform: getDomainPlatform(idx++, personaAssignments.second!),
          registration_price: d.registration_price,
        })),
      ]

      const payload = {
        domains: domainPayload,
        persona_details: Object.fromEntries(
          activePersonas.map((p) => [p, personaDetails[p]])
        ),
        redirect_url: redirectUrl,
      }

      const res = await fetch(`/api/clients/${client}/order-mailboxes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to place order")
        return
      }

      toast.success("Order placed successfully — tracking progress below")
      onOpenChange(false)
      onOrderComplete?.()
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setSubmitting(false)
    }
  }

  const { first, second, firstDomains, secondDomains, clampedCount } = personaAssignments
  const secondCount = domains.length - clampedCount

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!submitting) {
          onOpenChange(value)
          if (!value) setStep(1)
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Order Mailboxes — {client}</DialogTitle>
          <DialogDescription>
            {step === 1
              ? `${domains.length} domain${domains.length !== 1 ? "s" : ""} selected — configure personas and platform.`
              : "Review the cost breakdown and confirm your order."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-5 py-2">
            {/* ─── Persona Split ─── */}
            <div className="rounded-md border p-4 space-y-3">
              <Label className="text-sm font-medium">Persona Split</Label>
              {personas.length >= 2 ? (
                <div className="space-y-2">
                  {/* First persona row */}
                  <div className="flex items-center gap-3">
                    <span className="w-28 text-sm font-medium capitalize truncate">
                      {personaDetails[first]?.first_name ?? first}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      max={domains.length}
                      value={clampedCount}
                      onChange={(e) => handleSplitChange(parseInt(e.target.value) || 0)}
                      className="w-20 h-8 text-center"
                    />
                    <span className="text-sm text-muted-foreground">
                      domain{clampedCount !== 1 ? "s" : ""}
                    </span>
                    {platformMode === "per_persona" && (
                      <RadioGroup
                        value={personaPlatforms[first] ?? "google"}
                        onValueChange={(v: string) =>
                          setPersonaPlatforms((prev) => ({ ...prev, [first]: v as "google" | "microsoft" }))
                        }
                        className="flex gap-3 ml-auto"
                      >
                        <div className="flex items-center gap-1.5">
                          <RadioGroupItem value="google" id={`${first}-google`} />
                          <Label htmlFor={`${first}-google`} className="text-xs cursor-pointer">
                            Google
                          </Label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <RadioGroupItem value="microsoft" id={`${first}-ms`} />
                          <Label htmlFor={`${first}-ms`} className="text-xs cursor-pointer">
                            Microsoft
                          </Label>
                        </div>
                      </RadioGroup>
                    )}
                  </div>
                  {/* Second persona row */}
                  {second && (
                    <div className="flex items-center gap-3">
                      <span className="w-28 text-sm font-medium capitalize truncate">
                        {personaDetails[second]?.first_name ?? second}
                      </span>
                      <div className="w-20 h-8 flex items-center justify-center rounded-md border bg-muted text-sm tabular-nums">
                        {secondCount}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        domain{secondCount !== 1 ? "s" : ""}
                      </span>
                      {platformMode === "per_persona" && (
                        <RadioGroup
                          value={personaPlatforms[second] ?? "google"}
                          onValueChange={(v: string) =>
                            setPersonaPlatforms((prev) => ({
                              ...prev,
                              [second]: v as "google" | "microsoft",
                            }))
                          }
                          className="flex gap-3 ml-auto"
                        >
                          <div className="flex items-center gap-1.5">
                            <RadioGroupItem value="google" id={`${second}-google`} />
                            <Label htmlFor={`${second}-google`} className="text-xs cursor-pointer">
                              Google
                            </Label>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <RadioGroupItem value="microsoft" id={`${second}-ms`} />
                            <Label htmlFor={`${second}-ms`} className="text-xs cursor-pointer">
                              Microsoft
                            </Label>
                          </div>
                        </RadioGroup>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Total: {domains.length} domains, {domains.length * 2} mailboxes
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  All {domains.length} domains assigned to{" "}
                  <span className="font-medium capitalize">{first}</span>
                </p>
              )}
            </div>

            {/* ─── Platform ─── */}
            <div className="rounded-md border p-4 space-y-3">
              <Label className="text-sm font-medium">Platform</Label>
              <RadioGroup
                value={platformMode}
                onValueChange={(v: string) => setPlatformMode(v as PlatformMode)}
                className="flex gap-4"
              >
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="all_google" id="plat-google" />
                  <Label htmlFor="plat-google" className="text-sm cursor-pointer">
                    All Google
                  </Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="all_microsoft" id="plat-ms" />
                  <Label htmlFor="plat-ms" className="text-sm cursor-pointer">
                    All Microsoft
                  </Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="mixed" id="plat-mixed" />
                  <Label htmlFor="plat-mixed" className="text-sm cursor-pointer">
                    Mixed
                  </Label>
                </div>
                {personas.length >= 2 && (
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="per_persona" id="plat-per" />
                    <Label htmlFor="plat-per" className="text-sm cursor-pointer">
                      Per persona
                    </Label>
                  </div>
                )}
              </RadioGroup>
              {platformMode === "mixed" && (
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs w-14">Google</Label>
                    <Input
                      type="number"
                      min={0}
                      max={domains.length}
                      value={googleCount}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(parseInt(e.target.value) || 0, domains.length))
                        setGoogleCount(v)
                      }}
                      className="w-16 h-8 text-center"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs w-14">Microsoft</Label>
                    <div className="w-16 h-8 flex items-center justify-center rounded-md border bg-muted text-sm tabular-nums">
                      {domains.length - googleCount}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">of {domains.length} domains</span>
                </div>
              )}
              {platformMode === "per_persona" && (
                <p className="text-xs text-muted-foreground">
                  Set platform per persona above in the split section.
                </p>
              )}
            </div>

            {/* ─── Persona Details (collapsible) ─── */}
            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
              <div className="rounded-md border">
                <CollapsibleTrigger className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium cursor-pointer">Persona Details</Label>
                    {activePersonas.every(
                      (p) => personaDetails[p]?.first_name && personaDetails[p]?.last_name && personaDetails[p]?.profile_picture_url
                    ) ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                        <Check className="h-3 w-3" /> Pre-filled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                        <AlertTriangle className="h-3 w-3" /> Needs details
                      </span>
                    )}
                  </div>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      detailsOpen && "rotate-90"
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t px-4 pb-4 pt-3 space-y-4">
                    {activePersonas.map((persona) => {
                      const details = personaDetails[persona]
                      if (!details) return null
                      return (
                        <div key={persona} className="space-y-2">
                          <p className="text-sm font-medium capitalize">
                            {details.first_name} {details.last_name}
                            <span className="text-xs text-muted-foreground ml-2">
                              {details.first_name.toLowerCase()}@, {details.first_name.toLowerCase()}.
                              {details.last_name.toLowerCase()}@
                            </span>
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">First name</Label>
                              <Input
                                value={details.first_name}
                                onChange={(e) =>
                                  updatePersonaDetail(persona, "first_name", e.target.value)
                                }
                                className="mt-1 h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Last name</Label>
                              <Input
                                value={details.last_name}
                                onChange={(e) =>
                                  updatePersonaDetail(persona, "last_name", e.target.value)
                                }
                                className="mt-1 h-8"
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">
                              Profile picture
                              {details.profile_picture_url && (
                                <Check className="inline h-3 w-3 ml-1 text-emerald-600" />
                              )}
                            </Label>
                            <Input
                              type="url"
                              placeholder="https://..."
                              value={details.profile_picture_url}
                              onChange={(e) =>
                                updatePersonaDetail(persona, "profile_picture_url", e.target.value)
                              }
                              className="mt-1 h-8"
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* ─── Advanced (collapsible) ─── */}
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <div className="rounded-md border">
                <CollapsibleTrigger className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-sm font-medium cursor-pointer">Advanced</Label>
                  </div>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      advancedOpen && "rotate-90"
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t px-4 pb-4 pt-3">
                    <Label className="text-xs">Redirect URL</Label>
                    <Input
                      type="url"
                      value={redirectUrl}
                      onChange={(e) => setRedirectUrl(e.target.value)}
                      className="mt-1 h-8"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Client website URL used for domain redirects.
                    </p>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* ─── Domain List (compact, grouped by persona) ─── */}
            <div className="rounded-md border p-4 space-y-3">
              <Label className="text-sm font-medium">
                Domains ({domains.length})
              </Label>
              {domains.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No domains selected. Close and select domains first.
                </p>
              )}
              {firstDomains.length > 0 && (
                <DomainGroup
                  label={`${personaDetails[first]?.first_name ?? first} (${firstDomains.length})`}
                  domains={firstDomains}
                  persona={first}
                  startIndex={0}
                  getDomainPlatform={getDomainPlatform}
                  platformMode={platformMode}
                  getPersonaPlatform={getPersonaPlatform}
                  onRemove={removeDomain}
                />
              )}
              {second && secondDomains.length > 0 && (
                <DomainGroup
                  label={`${personaDetails[second]?.first_name ?? second} (${secondDomains.length})`}
                  domains={secondDomains}
                  persona={second}
                  startIndex={firstDomains.length}
                  getDomainPlatform={getDomainPlatform}
                  platformMode={platformMode}
                  getPersonaPlatform={getPersonaPlatform}
                  onRemove={removeDomain}
                />
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-2">
            {/* Persona preview cards — visual confirmation of who/what */}
            {activePersonas.map((persona) => {
              const pDomains = persona === first ? firstDomains : secondDomains
              const details = personaDetails[persona]
              const platformLabel = platformMode === "mixed"
                ? "Mixed (G + M)"
                : getPersonaPlatform(persona) === "google" ? "Google" : "Microsoft"
              const firstLower = (details?.first_name ?? "").toLowerCase()
              const lastLower = (details?.last_name ?? "").toLowerCase()
              const exampleDomain = pDomains[0]?.domain_name ?? "example.com"
              return (
                <div
                  key={persona}
                  className="flex items-start gap-3 rounded-md border p-3"
                >
                  {details?.profile_picture_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={details.profile_picture_url}
                      alt={`${details.first_name} ${details.last_name}`}
                      className="h-14 w-14 shrink-0 rounded-full object-cover border"
                    />
                  ) : (
                    <div className="h-14 w-14 shrink-0 rounded-full border bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
                      {(details?.first_name?.[0] ?? "?").toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">
                        {details?.first_name} {details?.last_name}
                      </p>
                      <span className="text-[10px] rounded-full border px-2 py-0.5 text-muted-foreground shrink-0">
                        {platformLabel}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {pDomains.length} domain{pDomains.length !== 1 ? "s" : ""} ·{" "}
                      {pDomains.length * 2} mailbox{pDomains.length * 2 !== 1 ? "es" : ""}
                    </p>
                    <div className="mt-1.5 space-y-0.5">
                      <p className="text-[11px] text-muted-foreground">Each domain gets 2 mailboxes:</p>
                      <code className="block text-xs text-foreground bg-muted/40 rounded px-2 py-0.5 truncate">
                        {firstLower}@{exampleDomain}
                      </code>
                      {lastLower && (
                        <code className="block text-xs text-foreground bg-muted/40 rounded px-2 py-0.5 truncate">
                          {firstLower}.{lastLower}@{exampleDomain}
                        </code>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Domain list (collapsible) */}
            <details className="rounded-md border">
              <summary className="cursor-pointer select-none list-none px-3 py-2 text-xs font-medium hover:bg-muted/40 flex items-center justify-between">
                <span>View all {domains.length} domains</span>
                <ChevronRight className="h-3.5 w-3.5 transition-transform" />
              </summary>
              <div className="max-h-32 overflow-y-auto border-t p-2">
                <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  {domains.map((d, i) => {
                    const persona = i < firstDomains.length ? first : second
                    const plat = getDomainPlatform(i, persona ?? first)
                    return (
                      <span key={d.id} className="break-all">
                        {d.domain_name}
                        {platformMode === "mixed" && (
                          <span className={plat === "google" ? "text-blue-600 ml-0.5" : "text-orange-600 ml-0.5"}>
                            ({plat === "google" ? "G" : "M"})
                          </span>
                        )}
                      </span>
                    )
                  })}
                </div>
              </div>
            </details>

            {/* Cost */}
            <div className="space-y-2 rounded-md border p-4">
              <div className="flex justify-between text-sm">
                <span>{costBreakdown.domainCount} domains</span>
                <span>${costBreakdown.totalDomainCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>
                  {costBreakdown.mailboxCount} mailboxes x ${MAILBOX_COST.toFixed(2)}
                </span>
                <span>${costBreakdown.totalMailboxCost.toFixed(2)}</span>
              </div>
              <div className="border-t pt-2 mt-2 flex justify-between text-sm font-semibold">
                <span>Total</span>
                <span>${costBreakdown.total.toFixed(2)}</span>
              </div>
            </div>

            {costBreakdown.total > 500 && (
              <div className="flex items-start gap-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                  Large order — please double-check before confirming.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 1 && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleNext} disabled={domains.length === 0}>
                Review Order
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)} disabled={submitting}>
                Back
              </Button>
              <Button onClick={handleConfirm} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Placing Order...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Place Order (${costBreakdown.total.toFixed(2)})
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DomainGroup({
  label,
  domains,
  persona,
  startIndex,
  getDomainPlatform,
  platformMode,
  getPersonaPlatform,
  onRemove,
}: {
  label: string
  domains: Domain[]
  persona: string
  startIndex: number
  getDomainPlatform: (idx: number, persona: string) => "google" | "microsoft"
  platformMode: PlatformMode
  getPersonaPlatform: (persona: string) => "google" | "microsoft"
  onRemove: (id: number) => void
}) {
  const platformLabel =
    platformMode === "mixed"
      ? "Mixed"
      : getPersonaPlatform(persona) === "google"
        ? "Google"
        : "Microsoft"

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground capitalize">
        {label} — {platformLabel}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {domains.map((d, i) => {
          const plat = getDomainPlatform(startIndex + i, persona)
          return (
            <span
              key={d.id}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
            >
              {d.domain_name}
              {platformMode === "mixed" && (
                <span className={plat === "google" ? "text-blue-600" : "text-orange-600"}>
                  {plat === "google" ? "G" : "M"}
                </span>
              )}
              <button
                onClick={() => onRemove(d.id)}
                className="ml-0.5 rounded hover:bg-muted-foreground/20 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )
        })}
      </div>
    </div>
  )
}
