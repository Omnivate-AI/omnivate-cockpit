import { createServerClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id || isNaN(Number(id))) {
    return Response.json(
      { error: "Valid id parameter is required" },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from("client_setups")
    .select("*")
    .eq("id", Number(id))
    .single()

  if (error || !data) {
    return Response.json(
      { error: "Setup not found" },
      { status: 404 }
    )
  }

  return Response.json({ setup: data })
}
