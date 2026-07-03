import { NextRequest } from "next/server"

/**
 * POST /api/analytics/refresh — PORT-1 "kick the sync".
 *
 * Dispatches the perf-sync GitHub Actions workflow (this repo's
 * .github/workflows/perf-sync.yml), which checks out the
 * smartlead-perf-plugin source and runs the real Smartlead → Supabase sync
 * in the cloud. Progress then surfaces through the existing freshness
 * plumbing: sp_sync_runs gets a new row, the Data Freshness widget polls it
 * every minute, and the facts-as-of date flips when the run completes.
 *
 * Requires env (Vercel): GITHUB_SYNC_TOKEN — fine-grained PAT with
 * Actions read+write on this repo. Optional: GITHUB_SYNC_REPO
 * (default Omnivate-AI/omnivate-cockpit), GITHUB_SYNC_WORKFLOW
 * (default perf-sync.yml), GITHUB_SYNC_REF (default main).
 * Until the token is configured this returns 501 with a clear message.
 */

const NOT_CONFIGURED =
  "Sync dispatch not configured — set GITHUB_SYNC_TOKEN (fine-grained PAT, " +
  "Actions read+write on the cockpit repo) in Vercel env. See docs/HANDOVER-2026-07-03.md."

export async function POST(_request: NextRequest) {
  const token = process.env.GITHUB_SYNC_TOKEN
  if (!token) {
    return Response.json(
      { error: NOT_CONFIGURED, disabled: true },
      { status: 501 }
    )
  }

  const repo = process.env.GITHUB_SYNC_REPO ?? "Omnivate-AI/omnivate-cockpit"
  const workflow = process.env.GITHUB_SYNC_WORKFLOW ?? "perf-sync.yml"
  const ref = process.env.GITHUB_SYNC_REF ?? "main"

  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref, inputs: {} }),
    }
  )

  // GitHub returns 204 No Content on a successful dispatch.
  if (res.status === 204) {
    return Response.json(
      {
        dispatched: true,
        message:
          "Sync dispatched — a new run appears in Data Freshness within a minute; facts refresh when it completes.",
      },
      { status: 202 }
    )
  }

  const detail = await res.text().catch(() => "")
  return Response.json(
    {
      error: `GitHub dispatch failed (${res.status})`,
      detail: detail.slice(0, 300),
    },
    { status: 502 }
  )
}

export async function GET() {
  return Response.json({
    configured: Boolean(process.env.GITHUB_SYNC_TOKEN),
  })
}
