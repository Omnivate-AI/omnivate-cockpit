import { createServerClient } from "@/lib/supabase/server"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { display_name, daily_email_target, daily_targets, runway_warning_days, runway_critical_days } = body

  // Validate types
  if (typeof display_name !== "string" || display_name.trim().length === 0) {
    return Response.json({ error: "display_name is required" }, { status: 400 })
  }
  if (typeof daily_email_target !== "number" || daily_email_target <= 0) {
    return Response.json({ error: "daily_email_target must be a positive number" }, { status: 400 })
  }
  if (typeof runway_warning_days !== "number" || runway_warning_days <= 0) {
    return Response.json({ error: "runway_warning_days must be a positive number" }, { status: 400 })
  }
  if (typeof runway_critical_days !== "number" || runway_critical_days <= 0) {
    return Response.json({ error: "runway_critical_days must be a positive number" }, { status: 400 })
  }

  // Validate daily_targets if provided
  const validDayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
  if (daily_targets != null) {
    if (typeof daily_targets !== "object") {
      return Response.json({ error: "daily_targets must be an object" }, { status: 400 })
    }
    for (const key of validDayKeys) {
      const val = (daily_targets as Record<string, unknown>)[key]
      if (typeof val !== "number" || val < 0) {
        return Response.json({ error: `daily_targets.${key} must be a non-negative number` }, { status: 400 })
      }
    }
  }

  const supabase = createServerClient()

  const updatePayload: Record<string, unknown> = {
    display_name: display_name.trim(),
    daily_email_target,
    runway_warning_days,
    runway_critical_days,
    updated_at: new Date().toISOString(),
  }
  if (daily_targets != null) {
    updatePayload.daily_targets = daily_targets
  }

  const { data, error } = await supabase
    .from("client_analytics_config")
    .update(updatePayload)
    .eq("client", slug)
    .select()
    .maybeSingle()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return Response.json({ error: "Client config not found" }, { status: 404 })
  }

  return Response.json({ success: true, data })
}
