import { test, expect } from "@playwright/test"

/** Audit log (ACT-2) + client comparison. Read-only. */

test("audit log renders filters, count and table", async ({ page }) => {
  await page.goto("/audit")
  await expect(page.getByRole("heading", { name: "Audit Log" })).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.getByText("Live action log").first()).toBeVisible()
  await expect(page.getByText(/actions? found/).first()).toBeVisible()
})

test("compare requires 2+ clients, then renders parameter panels", async ({ page }) => {
  await page.goto("/compare")
  await expect(
    page.getByRole("heading", { name: "Client Comparison" })
  ).toBeVisible({ timeout: 60_000 })
  await expect(
    page.getByText("Select at least 2 clients to compare")
  ).toBeVisible()
  // V4 E1 — the parameter picker is present before any client is selected
  await expect(page.getByText(/^Parameters \(/).first()).toBeVisible()

  await page.goto("/compare?clients=cylindo,paycaptain")
  // All six default parameter panels render (range in the title)
  await expect(page.getByText(/^Positive Replies — Last/).first()).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.getByText(/^Emails per Positive Reply — Last/).first()).toBeVisible()
  await expect(page.getByText(/^Contacts per Positive Reply — Last/).first()).toBeVisible()
  await expect(page.getByText(/^Volume \(Emails Sent\) — Last/).first()).toBeVisible()
  // The efficiency ratios carry the inverted-reading flag
  await expect(page.getByText("lower is better").first()).toBeVisible()

  // A metrics subset narrows the panels
  await page.goto("/compare?clients=cylindo,paycaptain&metrics=positives,volume")
  await expect(page.getByText(/^Positive Replies — Last/).first()).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.getByText(/^Reply Rate — Last/)).toHaveCount(0)
})
