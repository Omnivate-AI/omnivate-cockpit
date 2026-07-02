import { redirect } from "next/navigation"

// Onboarding is disabled in this build (FLAGS.onboarding = false): the wizard
// writes client_setups/setup_steps which have no sp_* backend. Client
// provisioning is owned by the email-infra + client-onboarding plugins.
export default function OnboardingPage() {
  redirect("/")
}
