import { test, expect } from "@playwright/test"

/**
 * V2 Phase 9 — the Daily Digest merged into the Command Center (one home).
 * /digest now redirects home, and the per-client breakdown + copy-to-clipboard
 * summary live on the Command Center as the "Daily Summary" section.
 */

test("/digest redirects to the Command Center", async ({ page }) => {
  await page.goto("/digest")
  await expect(page).toHaveURL(/\/(?:\?.*)?$/, { timeout: 60_000 })
  await expect(
    page.getByRole("heading", { name: "Command Center" })
  ).toBeVisible({ timeout: 60_000 })
})

test("Command Center carries the merged Daily Summary (breakdown + copy)", async ({
  page,
}) => {
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: "Command Center" })
  ).toBeVisible({ timeout: 60_000 })

  // The merged daily summary: title, per-client breakdown table headers,
  // and the copy-to-clipboard button (same Slack text as the old digest).
  await expect(page.getByText("Daily Summary").first()).toBeVisible({
    timeout: 60_000,
  })
  await expect(
    page.getByRole("button", { name: /copy/i }).first()
  ).toBeVisible()
  // Breakdown table columns
  for (const col of ["Sent", "Positive", "Total Replies", "Reply Rate"]) {
    await expect(page.getByText(col, { exact: true }).first()).toBeVisible()
  }
})
