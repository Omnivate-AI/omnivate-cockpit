import { test, expect } from "@playwright/test"

/**
 * API contracts the UI depends on. Uses the authenticated storage state
 * (cookies ride along on page.request).
 */

test("recent-runs returns sync runs plus the freshness payload", async ({
  page,
}) => {
  const res = await page.request.get("/api/tasks/recent-runs")
  expect(res.ok()).toBeTruthy()
  const data = await res.json()
  expect(Array.isArray(data.runs)).toBeTruthy()
  expect(data.freshness).toBeTruthy()
  for (const key of [
    "lastSyncAt",
    "latestFactDate",
    "latestSendEventAt",
    "latestReplyAt",
  ]) {
    expect(data.freshness).toHaveProperty(key)
  }
})

// The manual analytics-refresh dispatch (PORT-1) was dropped 2026-07-07
// (Omar) — the daily sync runs on its own schedule; the cockpit only
// reflects it via /api/tasks/recent-runs above.
