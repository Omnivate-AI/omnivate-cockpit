# V3 Phase 5 — Campaigns collapse · domain-health chart · placement · blacklist

**Status:** code complete · DB fix applied + verified · build green · **not yet pushed**
**Action points closed:** G1, H1, H3 + the blacklist reconciliation · H2 kept unchanged

---

## G1 — campaign sections collapsed by default

Only the **Active (primary)** section is open on load. **Follow-up** and **Referral** sections are now collapsible and **collapsed by default** (matching the existing Past section), so the page opens focused on active outbound. `components/campaigns/campaign-performance-table.tsx`.

## Blacklist reconciliation — the recurring "so many blacklisted" (H1-adjacent + H3 + data half of I1)

**Finding:** all **135** estate-wide "listed" domains are `listed_on = "SmartleadBadge: …"` — Smartlead's UI badge (shared-IP / SURBL noise), first-listed in one batch on 07-17. **Zero** are confirmed on an authoritative DNSBL. That's why inbox placement stays ~100%. Matches the earlier estate-wide blacklist review.

**Fix:**
- **Command Center card** "N blacklisted" → counts **confirmed authoritative listings only** (migration `cockpit_read_models_022.sql`: `vw_cockpit_portfolio_health.listed_domains` excludes `SmartleadBadge%`). Now **0** for every client (verified). `at_risk` is untouched — it's real warmup<97% (AP 7, Cylindo 11).
- **Blacklist Status card** (`blacklist-status-card.tsx` + `getClientBlacklist`) now splits **confirmed listed** (red, actionable) from **Smartlead-flagged (unverified)** — the badge domains show in a de-rated amber `<details>` explaining they're shared-IP noise, not confirmed listings. The red alarm only fires on real listings.

## H1 — domain-health chart, made legible

The dual-axis worst/median/p25 + at-risk-bars ComposedChart was unreadable. Simplified to **one line — the weakest domain each day vs the 97% burn line** (`mailbox-health-chart.tsx`). The "all healthy" banner + the "now: weakest X%, N below 97" summary stay above it; the hovercard still carries median/p25/at-risk detail. The chart now says one thing clearly.

## H3 — placement-test validity, explained

Added an info note to the Placement tab: inbox placement is the **ground-truth** deliverability signal, so ~100% inbox is valid even when domains carry Smartlead's badge — those are unverified noise, not confirmed listings (cross-links to Mailboxes → Blacklist Status). Resolves "if they're all blacklisted, is 100% inbox correct?" — yes, because they aren't really blacklisted.

## H2 — kept

The resting / reserve / lifecycle breakdown Omar liked is unchanged.

## Files / DB
- `components/campaigns/campaign-performance-table.tsx` (G1)
- `components/mailboxes/mailbox-health-chart.tsx` (H1)
- `components/clients/tabs/placement-tab-view.tsx` (H3)
- `lib/queries/orders.ts` + `components/mailboxes/blacklist-status-card.tsx` (blacklist split)
- `db/migrations/cockpit_read_models_022.sql` — portfolio `listed_domains` authoritative-only (applied live)

## Verification
- Portfolio `listed_domains` re-queried → **0** for all clients (was AP 36 / Cylindo 33).
- `npx tsc --noEmit` clean · `npm run build` compiled successfully.
- Visual (collapsed sections, simplified chart, card split) pending live review.

## Note for Phase 6
The blacklist reconciliation **reshapes Phase 6**: there is no real blacklist fire to action daily — the estate has **0 confirmed DNSBL listings**. The genuine "needs action" signal is **at-risk warmup boxes** (AP 7, Cylindo 11 below 97%) + burnt-mailbox alerts. Phase 6's action loop should target those, not the Smartlead-badge noise.
