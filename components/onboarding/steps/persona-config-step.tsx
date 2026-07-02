"use client"

import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import {
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Monitor,
  Mail,
  Upload,
  Link as LinkIcon,
  Image as ImageIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ---------- Types ----------

interface Persona {
  id: string
  first_name: string
  last_name: string
  profile_picture_url: string
}

interface SelectedDomain {
  name: string
  tld: string
  price: number
}

function createPersona(): Persona {
  return {
    id: crypto.randomUUID(),
    first_name: "",
    last_name: "",
    profile_picture_url: "",
  }
}

function getInitials(first: string, last: string): string {
  return (
    (first.charAt(0) + last.charAt(0)).toUpperCase() || "?"
  )
}

const MIN_PERSONAS = 1
const MAX_PERSONAS = 6

// ---------- Component ----------

interface PersonaConfigStepProps {
  onValidChange?: (valid: boolean) => void
}

export function PersonaConfigStep({ onValidChange }: PersonaConfigStepProps) {
  const searchParams = useSearchParams()
  const setupId = searchParams.get("setupId")

  const [personas, setPersonas] = useState<Persona[]>([createPersona()])
  const mailboxPerDomain = 2 // Fixed: 1x firstname@ + 1x firstname.lastname@ per domain
  const [googlePct, setGooglePct] = useState(50)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  // Domain count + selected domains from setup
  const [domainCount, setDomainCount] = useState(50)
  const [selectedDomains, setSelectedDomains] = useState<SelectedDomain[]>([])

  // Upload state per persona
  const [uploading, setUploading] = useState<Set<string>>(new Set())
  // Picture input mode per persona: "url" | "upload"
  const [pictureMode, setPictureMode] = useState<Map<string, "url" | "upload">>(
    new Map()
  )

  // ---------- Load setup data ----------

  useEffect(() => {
    if (!setupId) {
      setLoading(false)
      return
    }
    async function loadSetup() {
      try {
        const res = await fetch(`/api/onboarding/get-setup?id=${setupId}`)
        if (!res.ok) return
        const data = await res.json()
        const setup = data.setup
        if (!setup) return

        if (setup.domain_count) setDomainCount(setup.domain_count)
        if (setup.selected_domains) setSelectedDomains(setup.selected_domains)

        // Restore personas if saved
        if (Array.isArray(setup.persona_config) && setup.persona_config.length > 0) {
          setPersonas(
            setup.persona_config.map((p: Omit<Persona, "id">) => ({
              id: crypto.randomUUID(),
              first_name: p.first_name || "",
              last_name: p.last_name || "",
              profile_picture_url: p.profile_picture_url || "",
            }))
          )
          setSaved(true)
        }
      } catch {
        // use defaults
      } finally {
        setLoading(false)
      }
    }
    loadSetup()
  }, [setupId])

  // ---------- Computed values ----------

  const googleDomainCount = Math.round((domainCount * googlePct) / 100)
  const microsoftDomainCount = domainCount - googleDomainCount
  const googleMailboxCount = googleDomainCount * mailboxPerDomain
  const microsoftMailboxCount = microsoftDomainCount * mailboxPerDomain
  const totalMailboxes = googleMailboxCount + microsoftMailboxCount

  const allPersonasValid = personas.every(
    (p) => p.first_name.trim().length > 0 && p.last_name.trim().length > 0
  )

  // ---------- Persona management ----------

  function addPersona() {
    if (personas.length >= MAX_PERSONAS) return
    setPersonas((prev) => [...prev, createPersona()])
    setSaved(false)
  }

  function removePersona(id: string) {
    if (personas.length <= MIN_PERSONAS) return
    setPersonas((prev) => prev.filter((p) => p.id !== id))
    setSaved(false)
  }

  function updatePersona(id: string, field: keyof Persona, value: string) {
    setPersonas((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    )
    setSaved(false)
  }

  function getPictureMode(id: string): "url" | "upload" {
    return pictureMode.get(id) ?? "url"
  }

  function setPictureModeForPersona(id: string, mode: "url" | "upload") {
    setPictureMode((prev) => new Map(prev).set(id, mode))
  }

  // ---------- File upload ----------

  async function handleFileUpload(personaId: string, file: File) {
    if (!setupId) return

    const ALLOWED = ["image/jpeg", "image/png", "image/webp"]
    if (!ALLOWED.includes(file.type)) {
      toast.error("Only JPEG, PNG, and WebP images are allowed")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB")
      return
    }

    setUploading((prev) => new Set(prev).add(personaId))

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("setupId", setupId)
      formData.append("personaId", personaId)

      const res = await fetch("/api/onboarding/upload-avatar", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Upload failed")
        return
      }

      const data = await res.json()
      updatePersona(personaId, "profile_picture_url", data.url)
      toast.success("Image uploaded")
    } catch {
      toast.error("Upload failed — check your connection")
    } finally {
      setUploading((prev) => {
        const next = new Set(prev)
        next.delete(personaId)
        return next
      })
    }
  }

  // ---------- Mailbox preview ----------

  const mailboxPreview = useMemo(() => {
    if (!allPersonasValid || personas.length === 0) return []

    const hasRealDomains = selectedDomains.length > 0

    // Show up to 4 domains (= 8 mailboxes in preview)
    const previewDomains = hasRealDomains
      ? selectedDomains.slice(0, 4).map((d, i) => ({
          name: d.name,
          platform: (i < googleDomainCount ? "Google" : "Microsoft") as
            | "Google"
            | "Microsoft",
        }))
      : Array.from({ length: Math.min(4, domainCount) }, (_, i) => ({
          name: `domain${i + 1}.com`,
          platform: (i < googleDomainCount ? "Google" : "Microsoft") as
            | "Google"
            | "Microsoft",
        }))

    const previews: {
      email: string
      platform: "Google" | "Microsoft"
      persona: string
    }[] = []
    let personaIdx = 0

    for (const domain of previewDomains) {
      const persona = personas[personaIdx % personas.length]
      const first = persona.first_name.toLowerCase()
      const last = persona.last_name.toLowerCase()

      // Mailbox 1: firstname@domain
      previews.push({
        email: `${first}@${domain.name}`,
        platform: domain.platform,
        persona: `${persona.first_name} ${persona.last_name}`,
      })
      // Mailbox 2: firstname.lastname@domain
      previews.push({
        email: `${first}.${last}@${domain.name}`,
        platform: domain.platform,
        persona: `${persona.first_name} ${persona.last_name}`,
      })
      personaIdx++
    }

    return previews.slice(0, 8)
  }, [personas, allPersonasValid, googleDomainCount, domainCount, selectedDomains])

  // ---------- Save ----------

  const handleSave = useCallback(async () => {
    if (!setupId || !allPersonasValid) return
    setSaving(true)
    setError(null)

    try {
      const personaConfig = personas.map((p) => ({
        first_name: p.first_name.trim(),
        last_name: p.last_name.trim(),
        profile_picture_url: p.profile_picture_url.trim() || null,
      }))

      const res = await fetch("/api/onboarding/update-setup", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setupId: Number(setupId),
          persona_config: personaConfig,
          mailbox_per_domain: mailboxPerDomain,
          google_mailbox_count: googleMailboxCount,
          microsoft_mailbox_count: microsoftMailboxCount,
          total_mailboxes: totalMailboxes,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to save configuration")
        toast.error(data.error || "Failed to save configuration")
        return
      }

      setSaved(true)
      onValidChange?.(true)
      toast.success("Configuration saved")
    } catch {
      setError("Network error. Please try again.")
      toast.error("Failed to save — check your connection")
    } finally {
      setSaving(false)
    }
  }, [
    setupId,
    allPersonasValid,
    personas,
    googleMailboxCount,
    microsoftMailboxCount,
    totalMailboxes,
    onValidChange,
  ])

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const firstPersona = personas[0]
  const exampleFirst = firstPersona?.first_name?.trim() || "john"
  const exampleLast = firstPersona?.last_name?.trim() || "smith"

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Persona & Mailbox Configuration
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the personas for your outbound mailboxes and the
          Google/Microsoft platform split.
        </p>
      </div>

      {/* Persona Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">
            Personas ({personas.length}/{MAX_PERSONAS})
          </Label>
          <Button
            variant="outline"
            size="sm"
            onClick={addPersona}
            disabled={personas.length >= MAX_PERSONAS}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Persona
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {personas.map((persona, idx) => {
            const mode = getPictureMode(persona.id)
            const isUploading = uploading.has(persona.id)

            return (
              <div
                key={persona.id}
                className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4 space-y-3 animate-in fade-in zoom-in-95 duration-200 hover:border-stone-300 dark:hover:border-stone-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      {persona.profile_picture_url ? (
                        <AvatarImage
                          src={persona.profile_picture_url}
                          alt={`${persona.first_name} ${persona.last_name}`}
                        />
                      ) : null}
                      <AvatarFallback className="bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-sm font-medium">
                        {getInitials(persona.first_name, persona.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-foreground">
                      Persona {idx + 1}
                    </span>
                  </div>
                  {personas.length > MIN_PERSONAS && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removePersona(persona.id)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      First Name *
                    </Label>
                    <Input
                      placeholder="John"
                      value={persona.first_name}
                      onChange={(e) =>
                        updatePersona(persona.id, "first_name", e.target.value)
                      }
                      className={cn(
                        "h-9",
                        !persona.first_name.trim() &&
                          persona.last_name.trim() &&
                          "border-red-300 dark:border-red-700"
                      )}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Last Name *
                    </Label>
                    <Input
                      placeholder="Smith"
                      value={persona.last_name}
                      onChange={(e) =>
                        updatePersona(persona.id, "last_name", e.target.value)
                      }
                      className={cn(
                        "h-9",
                        !persona.last_name.trim() &&
                          persona.first_name.trim() &&
                          "border-red-300 dark:border-red-700"
                      )}
                    />
                  </div>
                </div>

                {/* Profile Picture — URL or Upload */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">
                      Profile Picture
                    </Label>
                    <div className="flex rounded-md border border-stone-200 dark:border-stone-700 overflow-hidden">
                      <button
                        onClick={() =>
                          setPictureModeForPersona(persona.id, "url")
                        }
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 text-[10px] font-medium transition-colors",
                          mode === "url"
                            ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300"
                            : "text-muted-foreground hover:bg-stone-50 dark:hover:bg-stone-800"
                        )}
                      >
                        <LinkIcon className="h-2.5 w-2.5" />
                        URL
                      </button>
                      <button
                        onClick={() =>
                          setPictureModeForPersona(persona.id, "upload")
                        }
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 text-[10px] font-medium transition-colors border-l border-stone-200 dark:border-stone-700",
                          mode === "upload"
                            ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300"
                            : "text-muted-foreground hover:bg-stone-50 dark:hover:bg-stone-800"
                        )}
                      >
                        <Upload className="h-2.5 w-2.5" />
                        Upload
                      </button>
                    </div>
                  </div>

                  {mode === "url" ? (
                    <Input
                      placeholder="https://example.com/photo.jpg"
                      value={persona.profile_picture_url}
                      onChange={(e) =>
                        updatePersona(
                          persona.id,
                          "profile_picture_url",
                          e.target.value
                        )
                      }
                      className="h-9"
                    />
                  ) : (
                    <label
                      className={cn(
                        "flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-3 cursor-pointer transition-colors",
                        isUploading
                          ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/30"
                          : persona.profile_picture_url
                            ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/30"
                            : "border-stone-200 dark:border-stone-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20"
                      )}
                    >
                      {isUploading ? (
                        <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
                      ) : persona.profile_picture_url ? (
                        <ImageIcon className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <Upload className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {isUploading
                          ? "Uploading..."
                          : persona.profile_picture_url
                            ? "Click to replace"
                            : "Click to upload — JPEG, PNG, WebP (max 2MB)"}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleFileUpload(persona.id, file)
                          e.target.value = ""
                        }}
                        disabled={isUploading}
                      />
                    </label>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Mailbox Format Info */}
      <div className="rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 p-4 space-y-1">
        <p className="text-sm font-medium text-foreground">
          2 mailboxes per domain
        </p>
        <p className="text-xs text-muted-foreground">
          Each domain gets two mailboxes with different username formats:
        </p>
        <div className="flex flex-col gap-0.5 mt-2">
          <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400">
            {exampleFirst.toLowerCase()}@domain.com
          </code>
          <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400">
            {exampleFirst.toLowerCase()}.{exampleLast.toLowerCase()}@domain.com
          </code>
        </div>
      </div>

      {/* Google/Microsoft Split */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          Google / Microsoft Split
        </Label>

        <div className="space-y-2">
          <div className="flex h-8 rounded-lg overflow-hidden border border-stone-200 dark:border-stone-700">
            <div
              className="bg-blue-500 flex items-center justify-center text-white text-xs font-medium transition-all duration-300"
              style={{ width: `${googlePct}%` }}
            >
              {googlePct > 15 && `${googlePct}% Google`}
            </div>
            <div
              className="bg-orange-500 flex items-center justify-center text-white text-xs font-medium transition-all duration-300"
              style={{ width: `${100 - googlePct}%` }}
            >
              {100 - googlePct > 15 && `${100 - googlePct}% Microsoft`}
            </div>
          </div>

          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={googlePct}
            onChange={(e) => {
              setGooglePct(Number(e.target.value))
              setSaved(false)
            }}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-stone-200 dark:bg-stone-700 accent-indigo-600"
          />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-sm bg-blue-500" />
              Google ({googlePct}%)
            </span>
            <span className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-sm bg-orange-500" />
              Microsoft ({100 - googlePct}%)
            </span>
          </div>
        </div>

        {/* Summary */}
        <div className="rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 p-4 space-y-2">
          <p className="text-sm text-foreground">
            <span className="font-medium">{domainCount}</span> domains →{" "}
            <span className="text-blue-600 dark:text-blue-400 font-medium">
              {googleDomainCount} Google domains ({googleMailboxCount} mailboxes)
            </span>{" "}
            +{" "}
            <span className="text-orange-600 dark:text-orange-400 font-medium">
              {microsoftDomainCount} Microsoft domains ({microsoftMailboxCount}{" "}
              mailboxes)
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Total: {totalMailboxes} mailboxes across {domainCount} domains
          </p>
        </div>

        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            <span className="font-medium">Platform rule:</span> Each domain
            uses one platform. First {googleDomainCount} domains → Google,
            remaining {microsoftDomainCount} → Microsoft.
          </p>
        </div>
      </div>

      {/* Mailbox Preview */}
      {mailboxPreview.length > 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">
            Mailbox Preview (first {mailboxPreview.length})
          </Label>
          <div className="rounded-lg border border-stone-200 dark:border-stone-700 divide-y divide-stone-100 dark:divide-stone-800 overflow-hidden">
            {mailboxPreview.map((preview, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-stone-900"
              >
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground font-mono flex-1 truncate">
                  {preview.email}
                </span>
                <div
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                    preview.platform === "Google"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      : "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                  )}
                >
                  <Monitor className="h-2.5 w-2.5" />
                  {preview.platform}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {preview.persona}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Save */}
      <Button
        onClick={handleSave}
        disabled={saving || !allPersonasValid}
        className="w-full"
      >
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving Configuration...
          </>
        ) : saved ? (
          "Configuration Saved — Click Next to Continue"
        ) : (
          "Save Configuration"
        )}
      </Button>
    </div>
  )
}
