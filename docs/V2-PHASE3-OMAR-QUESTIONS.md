# Phase 3 — two decisions that need Omar (nothing blocked, both cheap)

Both surfaced by the numbers audit (`docs/V2-AUDIT-FINDINGS.md`); Phase 3 fixed everything that didn't need a call from you. These two do.

## 1. OrbitalX — track it or retire it from the cockpit? (RC-8)

OrbitalX is marked **active** in the client registry, so it gets a client card and a digest row — but it was never wired into the daily performance sync (it's missing from the sync's client list), so it has **zero performance history**: the card renders blank/zeros forever. Its 20 campaigns (9 paused, 11 completed, 38.8k lifetime sends) are real; 9 paused campaigns can still send follow-ups that nobody is recording.

**Option A — track it:** one line in the sync (`orbitalx` matcher) + a history backfill (script exists from Phase 3). It then behaves like every other client.
**Option B — retire it:** flip `sp_clients.active=false`. It disappears from the cockpit and the 6 AM Slack post; history is preserved.

Whichever you pick is a 5-minute change. Recommendation: **A if OrbitalX is still a paying/active relationship, B if it's dormant.**

## 2. Per-client send targets — three clients, three inconsistencies (part of RC-5)

The cockpit now uses one target source everywhere (the app-config daily target, weekday-aware). But the *configured values* need your confirmation:

| Client | App target (drives bars/charts) | Send-floor alert (plugin) | Question |
|---|---|---|---|
| Acceleration Partners | 1,500/day | 1,500 | ✔ consistent — no action |
| PayCaptain | 3,000 Mon–Fri (weekday table; base field says 1,200) | 3,000 | Is 3,000/weekday still the intent? If yes we'll align the base field to match; if no, tell us the number. |
| Cylindo | 1,000/day | **not set** → the "sends below floor" alert can never fire for Cylindo | Should the floor be 1,000 (match the target)? |
| Omnivate | 500/day | not set | Currently ~idle — set a floor only if you want alerting. |

One Slack line per row is enough — we apply them in minutes.
