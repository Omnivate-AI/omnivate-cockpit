import { test, expect } from "@playwright/test"

/**
 * V3 (Omar 2026-07-20) — the Command Center "Yesterday" anchor must skip
 * weekends: checked on a Mon/Sat/Sun it shows the previous Friday, never a
 * near-empty weekend day. Read-only against whatever BASE_URL points at.
 */
test("Command Center 'Yesterday' anchors on a business day, not a weekend", async ({
  page,
}) => {
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: "Command Center" })
  ).toBeVisible()

  const body = await page.locator("body").innerText()

  // Default view is the 1-day "Yesterday"; the Emails Sent KPI card is titled
  // "Emails Sent (Ddd D Mon)" (en-GB short date, no comma) with the anchored
  // business day.
  const m = body.match(/Emails Sent \((Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([^)]+)\)/)
  expect(m, "Emails Sent card should carry a dated label").not.toBeNull()
  const weekday = m![1]
  const dateLabel = m![2].trim()

  // Also capture the freshness "Data as of …" weekday for the consistency check.
  const asOf = body.match(/Data as of\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/)

  console.log(
    `[weekend-anchor] Emails Sent card = "${weekday}, ${dateLabel}"` +
      (asOf ? ` | Data as of = "${asOf[1]}"` : " | (no 'Data as of' text found)")
  )

  expect(
    ["Sat", "Sun"].includes(weekday),
    `KPI anchor landed on ${weekday} (${dateLabel}) — it must skip weekends and show the last weekday`
  ).toBe(false)

  if (asOf) {
    expect(
      ["Sat", "Sun"].includes(asOf[1]),
      `"Data as of" landed on ${asOf[1]} — should match the business-day KPI anchor`
    ).toBe(false)
  }

  // The 1-day range toggle shows the actual weekday (e.g. "Friday"), never the
  // generic "Yesterday" (Omar 2026-07-20).
  await expect(page.getByRole("button", { name: "Yesterday" })).toHaveCount(0)

  // The "Needs Action Today" panel was removed from the Command Center.
  await expect(page.getByText("Needs Action Today")).toHaveCount(0)
})
