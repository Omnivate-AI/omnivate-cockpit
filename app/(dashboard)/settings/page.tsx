export const dynamic = "force-dynamic"

import { Settings, Database, Activity, Shield } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { getSettingsPageData } from "@/lib/queries"
import { BurnThresholdCard } from "@/components/settings/burn-threshold-card"
import { AppearanceCard } from "@/components/settings/appearance-card"
import { AccountCard } from "@/components/settings/account-card"
import { createServerClient } from "@/lib/supabase/server"
import { formatDistanceToNow } from "date-fns"

export default async function SettingsPage() {
  const [settings, userRes] = await Promise.all([
    getSettingsPageData(),
    (async () => {
      const supabase = createServerClient()
      // Fetch admin user email from the first user (service role can list users)
      const { data } = await supabase.auth.admin.listUsers({ perPage: 1 })
      return data?.users?.[0]?.email ?? "admin@omnivate.co.uk"
    })(),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure monitoring thresholds, appearance, and account settings.
        </p>
      </div>

      <Separator />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Section 1: Monitoring Configuration */}
        <BurnThresholdCard initialValue={settings.burnThreshold} />

        {/* Section 2: Appearance */}
        <AppearanceCard />

        {/* Section 3: Account */}
        <AccountCard email={userRes} />

        {/* Section 4: System Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-indigo-500" />
              <CardTitle className="text-lg">System Information</CardTitle>
            </div>
            <CardDescription>Overview of the current system state</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex items-center justify-between">
                <dt className="text-sm text-muted-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Total Domains
                </dt>
                <dd className="text-sm font-medium tabular-nums">
                  {settings.totalDomains}
                </dd>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <dt className="text-sm text-muted-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Total Accounts
                </dt>
                <dd className="text-sm font-medium tabular-nums">
                  {settings.totalAccounts}
                </dd>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <dt className="text-sm text-muted-foreground">Last Sync</dt>
                <dd className="text-sm font-medium">
                  {settings.lastSync
                    ? formatDistanceToNow(new Date(settings.lastSync), {
                        addSuffix: true,
                      })
                    : "No data yet"}
                </dd>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <dt className="text-sm text-muted-foreground">Database</dt>
                <dd className="text-sm font-mono text-muted-foreground">
                  uivg•••gjlv
                </dd>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <dt className="text-sm text-muted-foreground">Version</dt>
                <dd className="text-sm font-medium">v1.0.0</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
