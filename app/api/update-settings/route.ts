import { createServerClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const { key, value } = await request.json()

  if (!key || value === undefined) {
    return Response.json(
      { error: "Missing key or value" },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  const { error } = await supabase
    .from("app_settings")
    .upsert({
      key,
      value: JSON.stringify(value),
      updated_at: new Date().toISOString(),
    })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
