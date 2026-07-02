import { getWalletBalance } from "@/lib/inboxkit"

export async function GET() {
  try {
    const data = await getWalletBalance()
    // InboxKit returns: { total_credits, credits_used, credits_remaining, ... }
    const balance = data?.credits_remaining ?? data?.balance ?? 0
    return Response.json({ balance, currency: "USD" })
  } catch (error) {
    console.error("Failed to fetch wallet balance:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to fetch wallet balance" },
      { status: 500 }
    )
  }
}
