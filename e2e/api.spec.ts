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

test("analytics refresh reports its configuration state", async ({
  page,
}) => {
  const res = await page.request.get("/api/analytics/refresh")
  expect(res.ok()).toBeTruthy()
  const data = await res.json()
  expect(typeof data.configured).toBe("boolean")
})

test("refresh POST is honest when unconfigured", async ({ page }) => {
  const probe = await page.request.get("/api/analytics/refresh")
  const { configured } = await probe.json()
  const res = await page.request.post("/api/analytics/refresh")
  if (configured) {
    // Dispatch path: accepted (or a clear upstream error, never a 500 crash)
    expect([202, 502]).toContain(res.status())
  } else {
    expect(res.status()).toBe(501)
    const data = await res.json()
    expect(data.error).toContain("GITHUB_SYNC_TOKEN")
  }
})
