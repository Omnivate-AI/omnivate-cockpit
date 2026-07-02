"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, CheckCircle2, XCircle, Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

type SlugStatus = "idle" | "checking" | "available" | "taken"

export function ClientInfoStep() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const existingSetupId = searchParams.get("setupId")

  const [displayName, setDisplayName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugEdited, setSlugEdited] = useState(false)
  const [redirectUrl, setRedirectUrl] = useState("")
  const [domainCount, setDomainCount] = useState(50)
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track the slug loaded from DB to skip uniqueness check for own slug
  const [loadedSlug, setLoadedSlug] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!existingSetupId)

  // Pre-fill from DB when resuming an existing setup
  useEffect(() => {
    if (!existingSetupId) return

    async function loadSetup() {
      try {
        const res = await fetch(
          `/api/onboarding/get-setup?id=${existingSetupId}`
        )
        if (!res.ok) return
        const data = await res.json()
        const s = data.setup
        if (!s) return

        setDisplayName(s.display_name || "")
        setSlug(s.client_slug || "")
        setRedirectUrl(s.redirect_url || "")
        setDomainCount(s.domain_count || 50)
        setLoadedSlug(s.client_slug || null)
        setSlugEdited(true)
        setSlugStatus("available")
      } catch {
        // fail silently — user can re-enter
      } finally {
        setLoading(false)
      }
    }

    loadSetup()
  }, [existingSetupId])

  // Auto-generate slug from display name unless manually edited
  useEffect(() => {
    if (!slugEdited) {
      setSlug(toSlug(displayName))
    }
  }, [displayName, slugEdited])

  // Debounced slug uniqueness check
  useEffect(() => {
    if (!slug) {
      setSlugStatus("idle")
      return
    }

    // Skip check if slug matches the loaded setup's own slug
    if (loadedSlug && slug === loadedSlug) {
      setSlugStatus("available")
      return
    }

    setSlugStatus("checking")
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/onboarding/check-slug?slug=${encodeURIComponent(slug)}`
        )
        const data = await res.json()
        setSlugStatus(data.available ? "available" : "taken")
      } catch {
        setSlugStatus("idle")
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [slug, loadedSlug])

  const handleSlugChange = useCallback((value: string) => {
    setSlugEdited(true)
    setSlug(toSlug(value))
  }, [])

  const isEditing = !!existingSetupId

  const canSubmit =
    displayName.trim().length > 0 &&
    slug.length > 0 &&
    slugStatus === "available" &&
    !submitting

  async function handleSubmit() {
    if (!canSubmit) return

    setSubmitting(true)
    setError(null)

    try {
      if (isEditing) {
        // Update existing setup
        const res = await fetch("/api/onboarding/update-setup", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            setupId: Number(existingSetupId),
            display_name: displayName.trim(),
            redirect_url: redirectUrl.trim() || null,
            domain_count: domainCount,
          }),
        })

        const data = await res.json()
        if (!res.ok) {
          setError(data.error || "Failed to update setup")
          toast.error(data.error || "Failed to update setup")
          setSubmitting(false)
          return
        }

        toast.success("Setup updated")

        const params = new URLSearchParams(searchParams.toString())
        params.set("step", "domain-selection")
        router.push(`/onboarding?${params.toString()}`)
      } else {
        // Create new setup
        const res = await fetch("/api/onboarding/create-setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: displayName.trim(),
            slug,
            redirectUrl: redirectUrl.trim() || undefined,
            domainCount,
          }),
        })

        const data = await res.json()
        if (!res.ok) {
          setError(data.error || "Failed to create setup")
          toast.error(data.error || "Failed to create setup")
          setSubmitting(false)
          return
        }

        toast.success("Workspace created successfully")

        const params = new URLSearchParams(searchParams.toString())
        params.set("step", "domain-selection")
        params.set("setupId", String(data.setupId))
        router.push(`/onboarding?${params.toString()}`)
      }
    } catch {
      setError("Network error. Please try again.")
      toast.error("Network error")
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Client Information
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isEditing
            ? "Review and update client details."
            : "Enter the client details to create an InboxKit workspace."}
        </p>
      </div>

      {/* Display Name */}
      <div className="space-y-2">
        <Label htmlFor="displayName">Display Name</Label>
        <Input
          id="displayName"
          placeholder="e.g. Acme Corp"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={submitting}
        />
      </div>

      {/* Slug */}
      <div className="space-y-2">
        <Label htmlFor="slug">Client Slug</Label>
        <div className="relative">
          <Input
            id="slug"
            placeholder="e.g. acme-corp"
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            disabled={submitting || isEditing}
            className={cn(
              "pr-10",
              slugStatus === "taken" &&
                "border-red-500 focus-visible:ring-red-500",
              slugStatus === "available" &&
                "border-emerald-500 focus-visible:ring-emerald-500",
              isEditing && "opacity-60"
            )}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {slugStatus === "checking" && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {slugStatus === "available" && (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            )}
            {slugStatus === "taken" && (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
        </div>
        {slugStatus === "taken" && (
          <p className="text-xs text-red-500">
            This slug is already taken. Choose a different one.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {isEditing
            ? "Slug cannot be changed after workspace creation."
            : "Used as the unique identifier across the system. Lowercase letters, numbers, and hyphens only."}
        </p>
      </div>

      {/* Redirect URL */}
      <div className="space-y-2">
        <Label htmlFor="redirectUrl">Redirect URL</Label>
        <Input
          id="redirectUrl"
          type="url"
          placeholder="e.g. https://acmecorp.com"
          value={redirectUrl}
          onChange={(e) => setRedirectUrl(e.target.value)}
          disabled={submitting}
        />
        <p className="text-xs text-muted-foreground">
          The client&apos;s primary domain. Used for domain redirects.
        </p>
      </div>

      {/* Domain Count */}
      <div className="space-y-2">
        <Label htmlFor="domainCount">Number of Domains</Label>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={submitting || domainCount <= 10}
            onClick={() => setDomainCount((c) => Math.max(10, c - 10))}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Input
            id="domainCount"
            type="number"
            min={10}
            max={200}
            step={10}
            value={domainCount}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10)
              if (!isNaN(v)) setDomainCount(Math.min(200, Math.max(10, v)))
            }}
            disabled={submitting}
            className="text-center w-24"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={submitting || domainCount >= 200}
            onClick={() => setDomainCount((c) => Math.min(200, c + 10))}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {domainCount} domains x 2 = {domainCount * 2} mailboxes
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full"
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {isEditing ? "Saving..." : "Creating Workspace..."}
          </>
        ) : isEditing ? (
          "Save & Continue"
        ) : (
          "Create Workspace & Continue"
        )}
      </Button>
    </div>
  )
}
