import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from("mailbox_domain_candidates")
    .select("*")
    .eq("client", slug)
    .order("favorited", { ascending: false })
    .order("available", { ascending: false })
    .order("domain_name", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const body = await req.json()
  const { favorited } = body

  // Support both single id and bulk ids
  const ids: number[] = body.ids ?? [body.id]

  if (!ids.length || typeof favorited !== "boolean") {
    return NextResponse.json(
      { error: "Provide id (or ids) and favorited boolean" },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from("mailbox_domain_candidates")
    .update({ favorited, updated_at: new Date().toISOString() })
    .eq("client", slug)
    .in("id", ids)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!data?.length) {
    return NextResponse.json(
      { error: "No matching candidates found for this client" },
      { status: 404 }
    )
  }

  return NextResponse.json(data)
}
