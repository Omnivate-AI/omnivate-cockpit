import { test, expect } from "@playwright/test"

/**
 * Phase 4 acceptance measurement (V2 plan): time-to-visible-feedback on tab
 * clicks and range switches. Target: < 100ms, always.
 *
 * "Visible feedback" = the pressed state flips on the control the user
 * clicked (aria-selected on a tab trigger, the pressed styling on a range
 * button). Pre-Phase-4 both were derived from the URL, so nothing changed
 * until the full server round-trip finished — the "screen feels stagnant"
 * complaint. Post-Phase-4 the pressed state is optimistic client state.
 *
 * Opt-in (it's a measurement, not a regression gate — network variance would
 * flake CI):   MEASURE=1 npx playwright test feedback-timing
 * Run against production with BASE_URL=https://omnivate-cockpit.vercel.app
 */
const MEASURE = process.env.MEASURE === "1"

const CLIENT = "cylindo"
const SAMPLES = 3

/**
 * Arm a MutationObserver on the element matching (roleSel + exact text),
 * resolving ms from arm-time until it reads as "pressed". Runs entirely
 * in-page for precision; MUST be armed before the click and awaited after.
 */
function armPressedTimer(
  page: import("@playwright/test").Page,
  roleSel: string,
  label: string
): Promise<number> {
  return page.evaluate(
    ({ roleSel, label }) => {
      const els = Array.from(document.querySelectorAll(roleSel))
      const el = els.find((e) => (e.textContent ?? "").trim() === label)
      if (!el) return Promise.resolve(-1)
      // classList.contains is exact-token: the Tailwind variant literal
      // "data-[state=active]:bg-background" on radix triggers must NOT match.
      const pressed = () =>
        el.getAttribute("aria-selected") === "true" ||
        el.getAttribute("aria-pressed") === "true" ||
        el.getAttribute("data-state") === "active" ||
        el.classList.contains("bg-background")
      return new Promise<number>((resolve) => {
        if (pressed()) return resolve(0)
        // Clock starts at the browser's OWN mousedown — measuring from
        // arm-time would bill Playwright's click machinery (~100-300ms of
        // actionability checks) to the app.
        let t0: number | null = null
        el.addEventListener(
          "mousedown",
          () => {
            t0 = performance.now()
          },
          { once: true, capture: true }
        )
        const obs = new MutationObserver(() => {
          if (pressed()) {
            obs.disconnect()
            resolve(t0 === null ? -3 : performance.now() - t0)
          }
        })
        obs.observe(el, { attributes: true })
        setTimeout(() => {
          obs.disconnect()
          resolve(-2) // never flipped within 30s
        }, 30_000)
      })
    },
    { roleSel, label }
  )
}

test.describe("time-to-visible-feedback (Phase 4 acceptance)", () => {
  test.skip(!MEASURE, "measurement run only (MEASURE=1)")

  test("tab click pressed-state latency", async ({ page }) => {
    test.setTimeout(300_000)
    const samples: number[] = []
    // alternate between tabs so every click is a real switch
    const targets = ["Campaigns", "Positive Replies", "Alerts"]
    await page.goto(`/clients/${CLIENT}`)
    await page.getByRole("tab", { name: "Overview" }).waitFor({ timeout: 60_000 })
    for (let i = 0; i < SAMPLES; i++) {
      const label = targets[i % targets.length]
      const armed = armPressedTimer(page, '[role="tab"]', label)
      // tiny delay so the observer is armed before the click lands
      await page.waitForTimeout(50)
      await page.getByRole("tab", { name: label }).click({ noWaitAfter: true })
      samples.push(await armed)
      await page.waitForTimeout(4000) // let navigation settle
    }
    console.log(`TAB-FEEDBACK-MS: ${JSON.stringify(samples.map((s) => Math.round(s)))}`)
    expect(samples.every((s) => s >= 0)).toBe(true)
  })

  test("range switch pressed-state latency", async ({ page }) => {
    test.setTimeout(300_000)
    const samples: number[] = []
    const targets = ["14 Days", "30 Days", "14 Days"]
    await page.goto("/")
    await page.getByText("7 Days", { exact: true }).waitFor({ timeout: 60_000 })
    for (let i = 0; i < SAMPLES; i++) {
      const label = targets[i % targets.length]
      const armed = armPressedTimer(page, "button", label)
      await page.waitForTimeout(50)
      await page.getByRole("button", { name: label, exact: true }).click({ noWaitAfter: true })
      samples.push(await armed)
      await page.waitForTimeout(4000)
    }
    console.log(`RANGE-FEEDBACK-MS: ${JSON.stringify(samples.map((s) => Math.round(s)))}`)
    expect(samples.every((s) => s >= 0)).toBe(true)
  })
})
