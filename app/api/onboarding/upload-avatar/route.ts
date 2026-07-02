import { createServerClient } from "@/lib/supabase/server"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_SIZE = 2 * 1024 * 1024 // 2MB

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get("file") as File | null
  const setupId = formData.get("setupId") as string | null
  const personaId = formData.get("personaId") as string | null

  if (!file || !setupId || !personaId) {
    return Response.json(
      { error: "file, setupId, and personaId are required" },
      { status: 400 }
    )
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json(
      { error: "Only JPEG, PNG, and WebP images are allowed" },
      { status: 400 }
    )
  }

  if (file.size > MAX_SIZE) {
    return Response.json(
      { error: "Image must be under 2MB" },
      { status: 400 }
    )
  }

  const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1]
  const path = `${setupId}/${personaId}.${ext}`

  const supabase = createServerClient()

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    console.error("Avatar upload failed:", uploadError)
    return Response.json(
      { error: "Upload failed: " + uploadError.message },
      { status: 500 }
    )
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path)

  return Response.json({ url: publicUrl })
}
