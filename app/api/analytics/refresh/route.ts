import { NextRequest } from "next/server"
import { DISABLED_ACTION_MESSAGE } from "@/lib/flags"

/**
 * POST /api/analytics/refresh — DISABLED in this build.
 *
 * The legacy refresh-client-analytics Trigger.dev task wrote the retired
 * analytics_snapshots tables. Data now flows in via the smartlead-perf
 * plugin's daily sync (sp_* tables); an in-app "kick the sync" button is a
 * later build (PORT-1).
 */

export async function POST() {
  return Response.json(
    { error: DISABLED_ACTION_MESSAGE, disabled: true },
    { status: 501 }
  )
}

export async function GET(_request: NextRequest) {
  return Response.json(
    { error: DISABLED_ACTION_MESSAGE, disabled: true },
    { status: 501 }
  )
}
