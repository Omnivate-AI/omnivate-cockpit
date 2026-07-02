import { createServerClient } from "@/lib/supabase/server"

/**
 * PATCH /api/analytics/config — update client analytics config thresholds
 * Body: { client: string, daily_email_target?: number, runway_warning_days?: number, runway_critical_days?: number }
 */

export async function PATCH(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { client, daily_email_target, runway_warning_days, runway_critical_days } =
    body as {
      client?: string
      daily_email_target?: number
      runway_warning_days?: number
      runway_critical_days?: number
    }

  if (!client || typeof client !== "string") {
    return Response.json(
      { error: "client is required and must be a string" },
      { status: 400 }
    )
  }

  // Build update payload with only provided fields
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (daily_email_target !== undefined) {
    if (typeof daily_email_target !== "number" || daily_email_target < 0) {
      return Response.json(
        { error: "daily_email_target must be a non-negative number" },
        { status: 400 }
      )
    }
    updates.daily_email_target = daily_email_target
  }

  if (runway_warning_days !== undefined) {
    if (typeof runway_warning_days !== "number" || runway_warning_days < 0) {
      return Response.json(
        { error: "runway_warning_days must be a non-negative number" },
        { status: 400 }
      )
    }
    updates.runway_warning_days = runway_warning_days
  }

  if (runway_critical_days !== undefined) {
    if (typeof runway_critical_days !== "number" || runway_critical_days < 0) {
      return Response.json(
        { error: "runway_critical_days must be a non-negative number" },
        { status: 400 }
      )
    }
    updates.runway_critical_days = runway_critical_days
  }

  // Must have at least one field to update besides updated_at
  if (Object.keys(updates).length <= 1) {
    return Response.json(
      { error: "At least one of daily_email_target, runway_warning_days, or runway_critical_days is required" },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from("client_analytics_config")
    .update(updates)
    .eq("client", client)
    .select("*")
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return Response.json({ error: "Client config not found" }, { status: 404 })
  }

  return Response.json({ config: data })
}
