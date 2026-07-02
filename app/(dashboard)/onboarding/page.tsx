import { Suspense } from "react"
import { getAllSetups } from "@/lib/queries"
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"
import { OnboardingList } from "@/components/onboarding/onboarding-list"
import type { SetupListItem } from "@/lib/queries"

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function OnboardingPage({ searchParams }: PageProps) {
  const params = await searchParams
  const step = typeof params.step === "string" ? params.step : undefined

  // If step param is present, show the wizard
  if (step) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Client Onboarding
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set up a new client with domains, mailboxes, and Smartlead
            integration
          </p>
        </div>

        <Suspense>
          <OnboardingWizard />
        </Suspense>
      </div>
    )
  }

  // Otherwise show the list view
  let setups: SetupListItem[] = []
  try {
    setups = await getAllSetups()
  } catch {
    // fail gracefully — show empty state
  }

  return (
    <div className="space-y-6">
      <OnboardingList setups={setups} />
    </div>
  )
}
