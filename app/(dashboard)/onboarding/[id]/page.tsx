import { redirect } from "next/navigation"

// Onboarding is disabled in this build (FLAGS.onboarding = false).
export default function OnboardingDetailPage() {
  redirect("/")
}
