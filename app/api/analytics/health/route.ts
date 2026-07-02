/**
 * GET /api/analytics/health — returns configuration status for analytics dependencies
 */
export async function GET() {
  return Response.json({
    triggerConfigured: !!process.env.TRIGGER_SECRET_KEY,
    supabaseConfigured: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  })
}
