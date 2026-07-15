# Phase 7 — Mailboxes & Orders: Make Actions Real

**For:** Omar (review + decisions) · **From:** Amzat · **Date:** 2026-07-14
**Scope (plan):** every button on the Mailboxes tab either works safely or doesn't exist; the two uninformative charts say something; a per-domain drill-down; retire-domain + request-order proven end to end.

Live at https://omnivate-cockpit.vercel.app → any client → Mailboxes tab. Plugin side is [email-infra PR #2](https://github.com/Omnivate-AI/email-infra-plugin/pull/2).

## The six deliverables

### 1. Retire Domain — now a real decision, not a dead button
Before: the "Retire Domain" button POSTed `/api/domains/drain`, a disabled **410 stub** on the retired mailbox_* model — it errored on click. The confirm dialog claimed it acted "immediately."

Now, mirroring Request Order's proven pattern:
- The button POSTs `/api/clients/{slug}/retire-domain`, which raises a **`retire_domain` decision** (`pending`, domain-scoped payload, deduped per domain). Raising it **spends and destroys nothing.**
- The dialog now says the truth: it raises a proposal for approval; a supervised run executes the retirement only after approval.
- The decision shows in the infrastructure decisions panel; approving it (in-app or via the Slack button) flips it to `approved`.
- A **supervised** email-infra `retire-engine.mjs` executes an approved decision: drains each box (cap 0 + warmup off, kept in campaign for replies), sets catch-all → master, tags retired, sets the domain draining, and defers the real InboxKit cancel +30d to the existing `process-due-cancels`. The decision goes `executed`.
- Flag `infraRetireDomain` (on — the button is non-destructive; the destructive step stays supervised plugin-side).

**Proven (staged, dry-run):** an approved `retire_domain` decision for `clearcylindo.com` (2 boxes) → `retire-engine --dry-run` resolved both boxes, the live InboxKit domain uid, the master catch-all, and the full drain plan, **wrote nothing**. Decision superseded; no approved retire decisions remain. A live retirement needs a genuinely-due domain + `retire-engine --decision N --apply` (deliberately not run on a healthy domain).

### 2. Request Order — proven reliable end to end
The path is: cockpit **Request order** → `order_mailboxes` decision (`pending`) → approve (in-app / Slack) → supervised `order-engine` proposes + `place-order --apply` spends.

Fixed a real reliability bug (audit mismatch-risk #2): a cockpit request **stranded forever** unless the live reserve gap ≥ 10, because `order-engine` only advanced its own gap-driven detections. Now a manual cockpit request is honored regardless of bench state (orders at least one 2-box domain), marked manual-origin through to the Slack proposal.

**Proven (staged, dry-run):** AP with a full bench (gap 0) → the engine now *"honors despite healthy bench, orders the minimum 2-box domain"* → proposes 2 mailboxes / $18.48. Before the fix it logged *"leaving as-is"* and stranded. Test decision superseded.

### 3. Domain Health chart — worst/at-risk, not flat-100
The old chart averaged every domain's warmup into one line. A healthy pool sits at 99–100 so it drew a flat line forever — **and it hid dead boxes**: measured, Acceleration Partners shows a **99.2 average while one mailbox sits at warmup 0.0**; Cylindo 99.4 with a box at 71.

Now it plots the **weakest domain** (min) + p25/median band + an **at-risk-domain count** (bars, right axis), with the 97 burn line. When every day's weakest stays ≥ 97 it shows an explicit **"all domains healthy"** banner instead of a meaningless flat line (Omnivate/PayCaptain are genuinely all-100; AP/Cylindo now surface their weak boxes).

### 4. Lifecycle & Health History — weighted + split in two
- **Weighting fixed:** the pool-average warmup for parent clients used `(a+b)/2` across child slugs (the code even called it "weighted-enough" — it wasn't). Now it's a **mailbox-count-weighted** grand mean, so a 20-box slug counts 10× a 2-box slug. (Single-slug clients were already correct; the bug only bit parent clients.)
- **Split:** the mashed dual-axis chart (4 lifecycle counts + a warmup % on two scales) is now **two readable charts** — lifecycle mix (stacked areas) and average warmup % + at-risk count — sharing one x-axis.

### 5. Domain drill-down
The Lifecycle Distribution card's states (Active / Resting / Reserve / Warming / …) are now **clickable**. Clicking one reveals its **per-domain list**: domains sorted weakest-first, with box count, worst + median warmup (red under 97), tag chips, and age. Built from the mailbox inventory the tab already loads — no extra query.

### 6. Orders-page audit fix
The scope label ("orders placed via this system since Jun 2026 — the original pools predate order tracking") shipped in Phase 3; verified present. No other orders-page data issues survived the audit.

## Judgment calls & decisions for Omar

| # | Call | Note |
|---|---|---|
| 1 | Retire execution is **supervised**, not auto-cron | `retire-engine.mjs` runs by hand (`--apply`), like `handle-burn`/`place-order`. It cancels real InboxKit billing (deferred +30d), so it's deliberately not in the daily task. Wire it into cron only if you want approved retirements to auto-execute. |
| 2 | Retire raises a decision; the button is **on** (`infraRetireDomain`) | Raising a proposal is non-destructive (like Request Order). The destructive step stays approval-gated + supervised. Contrast `infraSwapEscalate` (still dark) which writes lifecycle directly. |
| 3 | Manual order requests order **at least one 2-box domain** on a healthy bench | The operator explicitly asked; the engine no longer strands it. If you'd rather a healthy-bench request be declined with "bench already full," that's a one-line change. |
| 4 | `RotateButton` on the **Alerts** tab still hits a disabled 410 endpoint | Out of Phase 7 scope (Mailboxes tab). It's an alerts action → **Phase 8** (which reworks alert actions/routing). Flagged so it's not forgotten. |
| 5 | `burnt-domains-list.tsx` is orphaned dead code | Not mounted anywhere, so unreachable — left as-is; can be deleted in a cleanup. |
| 6 | Domain "age" = oldest box's `created_at` | Domains themselves aren't consistently in `sp_domains` for AP/PayCaptain, so the drill-down derives everything (age, health, tags) from the mailbox inventory — self-consistent with the rest of the tab. |

## Where things live
- Retire route: `app/api/clients/[slug]/retire-domain/route.ts`; button: `components/mailboxes/mailbox-inventory-table.tsx`.
- Charts: `components/mailboxes/mailbox-health-chart.tsx` (bands query `getClientDomainHealthBands`), `components/mailboxes/lifecycle-history-card.tsx` (split), warmup weighting `lib/queries/portfolio.ts`.
- Drill-down: `components/mailboxes/lifecycle-breakdown.tsx`.
- Plugin executors: `email-infra/scripts/retire-engine.mjs`, `order-engine.mjs` (PR #2).
