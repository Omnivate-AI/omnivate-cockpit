import { notFound } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Globe,
  Mail,
  ExternalLink,
  RotateCw,
  Zap,
  AlertTriangle,
  Info,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { getSetupWithSteps } from "@/lib/queries"
import type { SetupStatus, StepStatus } from "@/lib/types"
import { SetupDetailClient } from "./setup-detail-client"

const STATUS_CONFIG: Record<
  SetupStatus,
  { label: string; color: string; bgColor: string }
> = {
  draft: {
    label: "Draft",
    color: "text-stone-600 dark:text-stone-400",
    bgColor: "bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700",
  },
  configuring: {
    label: "Configuring",
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800",
  },
  purchasing: {
    label: "Purchasing",
    color: "text-amber-700 dark:text-amber-300",
    bgColor: "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800",
  },
  provisioning: {
    label: "Provisioning",
    color: "text-sky-700 dark:text-sky-300",
    bgColor: "bg-sky-50 dark:bg-sky-950 border-sky-200 dark:border-sky-800",
  },
  smartlead_pending: {
    label: "Smartlead Pending",
    color: "text-violet-700 dark:text-violet-300",
    bgColor: "bg-violet-50 dark:bg-violet-950 border-violet-200 dark:border-violet-800",
  },
  completed: {
    label: "Completed",
    color: "text-emerald-700 dark:text-emerald-300",
    bgColor: "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800",
  },
  failed: {
    label: "Failed",
    color: "text-red-700 dark:text-red-300",
    bgColor: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800",
  },
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

interface SetupDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function SetupDetailPage({ params }: SetupDetailPageProps) {
  const { id } = await params

  const numericId = Number(id)
  if (isNaN(numericId)) {
    notFound()
  }

  const setup = await getSetupWithSteps(numericId)
  if (!setup) {
    notFound()
  }

  const statusConfig = STATUS_CONFIG[setup.status]
  const completedSteps = setup.steps.filter((s) => s.status === "completed").length
  const failedSteps = setup.steps.filter((s) => s.status === "failed")
  const hasFailedSteps = failedSteps.length > 0

  // Determine if Smartlead phase can be manually triggered
  const mailboxStep = setup.steps.find((s) => s.step_name === "mailboxes_provisioned")
  const smartleadSeqStep = setup.steps.find((s) => s.step_name === "smartlead_sequencer_created")
  const canTriggerSmartlead =
    mailboxStep?.status === "completed" &&
    (smartleadSeqStep?.status === "pending" || smartleadSeqStep?.status === "failed") &&
    (setup.status === "smartlead_pending" || setup.status === "provisioning" || setup.status === "failed")

  // Parse selected_domains for domain breakdown
  const selectedDomains = (setup.selected_domains as unknown as Array<{ name: string; tld: string; price: number }>) ?? []
  const domainCount = setup.domain_count ?? selectedDomains.length
  const googleCount = setup.google_mailbox_count ?? 0
  const microsoftCount = setup.microsoft_mailbox_count ?? 0
  const mailboxPerDomain = setup.mailbox_per_domain ?? 2

  // Compute which domains are Google vs Microsoft
  const googleDomainCount = Math.round(domainCount * (googleCount / Math.max(googleCount + microsoftCount, 1)))
  const msDomainCount = domainCount - googleDomainCount

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/onboarding"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Onboarding
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">
              {setup.display_name}
            </h1>
            <Badge
              className={cn(
                "text-xs px-2.5 py-0.5 border",
                statusConfig.bgColor,
                statusConfig.color
              )}
            >
              {statusConfig.label}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground font-mono">
            {setup.client_slug}
          </p>
          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <span>Created {formatDate(setup.created_at)}</span>
            {setup.completed_at && (
              <span>Completed {formatDate(setup.completed_at)}</span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {setup.status === "completed" && (
            <Button asChild>
              <Link href={`/clients/${setup.client_slug}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                View Client Dashboard
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Auto-reconnect reminder banner */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
        <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Remember to enable auto-reconnect in InboxKit UI
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
            Auto-reconnect is not available via API and must be enabled manually in the InboxKit dashboard for each workspace.
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Domains</span>
            </div>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {domainCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Mailboxes</span>
            </div>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {setup.total_mailboxes ?? domainCount * mailboxPerDomain}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-muted-foreground">Progress</span>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {completedSteps}/{setup.steps.length || 10}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-muted-foreground">Cost</span>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {setup.estimated_cost_usd != null
                ? setup.estimated_cost_usd.toLocaleString("en-US", { style: "currency", currency: "USD" })
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Provisioning Timeline — realtime via client component */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Provisioning Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <SetupDetailClient
            setupId={setup.id}
            initialSteps={setup.steps}
            hasFailedSteps={hasFailedSteps}
            canTriggerSmartlead={canTriggerSmartlead}
          />
        </CardContent>
      </Card>

      {/* Domain/Mailbox Breakdown (show when domains are selected) */}
      {selectedDomains.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Domain & Mailbox Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead className="text-right">Mailboxes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedDomains.map((domain, idx) => {
                  const isGoogle = idx < googleDomainCount
                  return (
                    <TableRow key={domain.name}>
                      <TableCell className="font-mono text-sm">
                        {domain.name}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "text-[10px] px-2 py-0.5 border",
                            isGoogle
                              ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                              : "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800"
                          )}
                        >
                          {isGoogle ? "Google" : "Microsoft"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {mailboxPerDomain}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                <span className="inline-block h-2 w-2 rounded-full bg-blue-500 mr-1" />
                Google: {googleDomainCount} domains ({googleCount} mailboxes)
              </span>
              <span>
                <span className="inline-block h-2 w-2 rounded-full bg-orange-500 mr-1" />
                Microsoft: {msDomainCount} domains ({microsoftCount} mailboxes)
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
