"use client"

import { useState, useCallback } from "react"
import {
  WizardShell,
  type WizardStepId,
} from "@/components/onboarding/wizard-shell"
import { ClientInfoStep } from "@/components/onboarding/steps/client-info-step"
import { DomainSelectionStep } from "@/components/onboarding/steps/domain-selection-step"
import { PersonaConfigStep } from "@/components/onboarding/steps/persona-config-step"
import { ReviewStep } from "@/components/onboarding/steps/review-step"
import { ProvisioningStep } from "@/components/onboarding/steps/provisioning-step"

export function OnboardingWizard() {
  const [domainNextBlocked, setDomainNextBlocked] = useState(true)

  const handleNoDomains = useCallback((blocked: boolean) => {
    setDomainNextBlocked(blocked)
  }, [])

  const steps: Record<WizardStepId, React.ReactNode> = {
    "client-info": <ClientInfoStep />,
    "domain-selection": (
      <DomainSelectionStep onInsufficientBalanceChange={handleNoDomains} />
    ),
    "persona-config": <PersonaConfigStep />,
    review: <ReviewStep />,
    provisioning: <ProvisioningStep />,
  }

  return (
    <WizardShell disableNext={{ "domain-selection": domainNextBlocked }}>
      {steps}
    </WizardShell>
  )
}
