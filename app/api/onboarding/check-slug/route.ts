import { createServerClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const slug = url.searchParams.get("slug")

  if (!slug) {
    return Response.json({ error: "slug is required" }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data } = await supabase
    .from("client_setups")
    .select("id")
    .eq("client_slug", slug)
    .limit(1)

  return Response.json({ available: !data || data.length === 0 })
}
