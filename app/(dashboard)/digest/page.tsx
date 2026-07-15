import { redirect } from "next/navigation"

// V2 Phase 9 — the Daily Digest merged into the Command Center (one home).
// This route now redirects home so any bookmark / link keeps working.
export default function DigestPage() {
  redirect("/")
}
