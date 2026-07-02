"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import type { EligibleAccount } from "@/lib/queries"

interface ChangeMasterDialogProps {
  client: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChangeMasterDialog({
  client,
  open,
  onOpenChange,
}: ChangeMasterDialogProps) {
  const router = useRouter()
  const [eligible, setEligible] = useState<EligibleAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedId, setSelectedId] = useState<string>("")

  // Fetch eligible accounts when dialog opens
  useEffect(() => {
    if (!open || !client) return

    setLoading(true)
    setSelectedId("")
    setEligible([])

    const supabase = createClient()

    async function fetchEligible() {
      const { data } = await supabase
        .from("mailbox_accounts")
        .select(
          "id, email, domain_id, warmup_health_pct, is_master_inbox, lifecycle_status, mailbox_domains!inner(domain_name, warmup_health_avg)"
        )
        .eq("client", client!)
        .in("lifecycle_status", ["active", "ramping"])
        .gt("warmup_health_pct", 90)
        .order("email", { ascending: true })

      if (data) {
        const accounts: EligibleAccount[] = data.map((a) => {
          const domain = a.mailbox_domains as unknown as {
            domain_name: string
            warmup_health_avg: number | null
          }
          return {
            id: a.id,
            email: a.email,
            domain_id: a.domain_id,
            domain_name: domain?.domain_name ?? "",
            warmup_health_pct: a.warmup_health_pct,
            domain_health: domain?.warmup_health_avg ?? null,
            is_master_inbox: a.is_master_inbox,
          }
        })
        setEligible(accounts)

        // Pre-select current master if exists
        const current = accounts.find((a) => a.is_master_inbox)
        if (current) {
          setSelectedId(String(current.id))
        }
      }
      setLoading(false)
    }

    fetchEligible()
  }, [open, client])

  // Group eligible accounts by domain
  const groupedByDomain = eligible.reduce<
    Record<string, EligibleAccount[]>
  >((acc, a) => {
    const key = a.domain_name
    if (!acc[key]) acc[key] = []
    acc[key].push(a)
    return acc
  }, {})

  const selectedAccount = eligible.find((a) => String(a.id) === selectedId)
  const showDomainWarning =
    selectedAccount && selectedAccount.domain_health !== null && selectedAccount.domain_health < 95

  async function handleConfirm() {
    if (!selectedId || !client) return

    setSaving(true)
    try {
      const res = await fetch("/api/update-master-inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: client,
          newMasterAccountId: Number(selectedId),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error("Failed to update master inbox", {
          description: data.error || "An error occurred",
        })
        setSaving(false)
        return
      }

      toast.success("Master inbox updated", {
        description: `${selectedAccount?.email} is now the master inbox for ${client}`,
      })
      onOpenChange(false)
      router.refresh()
    } catch {
      toast.error("Network error", {
        description: "Could not reach the server",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={saving ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            Change Master Inbox{" "}
            {client && (
              <span className="capitalize font-normal text-muted-foreground">
                — {client}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Select an eligible account to serve as the master inbox for this
            client. Only active/ramping accounts with health above 90% are
            shown.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading eligible accounts...
              </span>
            </div>
          ) : eligible.length === 0 ? (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  No eligible accounts found. Accounts must be active or
                  ramping with health above 90%.
                </p>
              </div>
            </div>
          ) : (
            <>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an account..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(groupedByDomain).map(
                    ([domainName, accounts]) => (
                      <SelectGroup key={domainName}>
                        <SelectLabel className="text-xs text-muted-foreground">
                          {domainName}
                        </SelectLabel>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={String(a.id)}>
                            <span className="font-mono text-xs">
                              {a.email}
                            </span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {a.warmup_health_pct?.toFixed(0)}%
                            </span>
                            {a.is_master_inbox && (
                              <span className="ml-1 text-xs text-amber-600">
                                (current)
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )
                  )}
                </SelectContent>
              </Select>

              {showDomainWarning && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    This account&apos;s domain health is{" "}
                    {selectedAccount.domain_health?.toFixed(0)}% — below 95%.
                    Consider choosing an account on a healthier domain.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={handleConfirm}
            disabled={saving || !selectedId || eligible.length === 0}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Saving...
              </>
            ) : (
              "Confirm"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
