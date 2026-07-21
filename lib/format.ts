/**
 * Ratio display rule (V4 plan, judgment call #5): whole numbers at ≥10
 * ("1,084"), one decimal below 10 ("6.3") — matches how you'd say them aloud.
 * null → "—" (no positive replies in range yet).
 */
export function formatRatio(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—"
  if (v >= 10) return Math.round(v).toLocaleString()
  return v.toFixed(1)
}
