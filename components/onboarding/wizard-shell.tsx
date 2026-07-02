"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useRef, useState, useEffect } from "react"
import {
  Building2,
  Globe,
  Users,
  ClipboardCheck,
  Rocket,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const WIZARD_STEPS = [
  { id: "client-info", label: "Client Info", icon: Building2 },
  { id: "domain-selection", label: "Domain Selection", icon: Globe },
  { id: "persona-config", label: "Persona & Config", icon: Users },
  { id: "review", label: "Review", icon: ClipboardCheck },
  { id: "provisioning", label: "Provisioning", icon: Rocket },
] as const

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"]

interface WizardShellProps {
  children: Record<WizardStepId, React.ReactNode>
  disableNext?: Partial<Record<WizardStepId, boolean>>
}

export function WizardShell({ children, disableNext }: WizardShellProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentStepId =
    (searchParams.get("step") as WizardStepId) || "client-info"
  const setupId = searchParams.get("setupId")

  const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStepId)
  const safeIndex = currentIndex === -1 ? 0 : currentIndex

  // Fade transition state
  const [visible, setVisible] = useState(true)
  const [displayedStep, setDisplayedStep] = useState(currentStepId)
  const prevStepRef = useRef(currentStepId)

  useEffect(() => {
    if (prevStepRef.current !== currentStepId) {
      setVisible(false)
      const timer = setTimeout(() => {
        setDisplayedStep(currentStepId)
        setVisible(true)
      }, 150)
      prevStepRef.current = currentStepId
      return () => clearTimeout(timer)
    }
  }, [currentStepId])

  const buildUrl = useCallback(
    (stepId: string) => {
      const params = new URLSearchParams()
      params.set("step", stepId)
      if (setupId) params.set("setupId", setupId)
      return `/onboarding?${params.toString()}`
    },
    [setupId]
  )

  function handleBack() {
    if (safeIndex > 0) {
      router.push(buildUrl(WIZARD_STEPS[safeIndex - 1].id))
    }
  }

  function handleNext() {
    if (safeIndex < WIZARD_STEPS.length - 1) {
      router.push(buildUrl(WIZARD_STEPS[safeIndex + 1].id))
    }
  }

  const activeStep = WIZARD_STEPS[safeIndex]
  const isFirstStep = safeIndex === 0
  const isLastStep = safeIndex === WIZARD_STEPS.length - 1

  return (
    <div className="space-y-8">
      {/* Step Indicator */}
      <nav aria-label="Onboarding progress" className="px-2">
        <ol className="flex items-center justify-between">
          {WIZARD_STEPS.map((step, idx) => {
            const isCompleted = idx < safeIndex
            const isActive = idx === safeIndex
            const Icon = step.icon

            return (
              <li
                key={step.id}
                className="flex flex-1 items-center last:flex-none"
              >
                <div className="flex flex-col items-center gap-2">
                  {/* Circle */}
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-200",
                      isCompleted &&
                        "border-emerald-500 bg-emerald-500 text-white",
                      isActive &&
                        "border-indigo-600 ring-4 ring-indigo-100 dark:ring-indigo-950 bg-indigo-600 text-white",
                      !isCompleted &&
                        !isActive &&
                        "border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-400 dark:text-stone-500"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={cn(
                      "text-xs font-medium text-center whitespace-nowrap",
                      isActive && "text-indigo-600 dark:text-indigo-400",
                      isCompleted && "text-emerald-600 dark:text-emerald-400",
                      !isActive &&
                        !isCompleted &&
                        "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Connector line */}
                {idx < WIZARD_STEPS.length - 1 && (
                  <div
                    className={cn(
                      "mx-3 mt-[-1.5rem] h-0.5 flex-1",
                      idx < safeIndex
                        ? "bg-emerald-500"
                        : "bg-stone-200 dark:bg-stone-700"
                    )}
                  />
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      {/* Step Content */}
      <div
        className={cn(
          "min-h-[400px] transition-opacity duration-150",
          visible ? "opacity-100" : "opacity-0"
        )}
      >
        {children[displayedStep as WizardStepId] ?? children[activeStep.id]}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between border-t border-stone-200 dark:border-stone-700 pt-6">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={isFirstStep}
          className="min-w-[100px]"
        >
          Back
        </Button>

        {!isLastStep && (
          <Button
            onClick={handleNext}
            disabled={disableNext?.[activeStep.id] ?? false}
            className="min-w-[100px]"
          >
            Next
          </Button>
        )}
      </div>
    </div>
  )
}

export { WIZARD_STEPS }
