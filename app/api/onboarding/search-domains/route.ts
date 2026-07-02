import { createServerClient } from "@/lib/supabase/server"
import {
  checkDomainAvailable,
  checkWorkspaceAvailability,
} from "@/lib/inboxkit"

// ---------------------------------------------------------------------------
// POST /api/onboarding/search-domains  (SSE streaming)
//
// Input:  { setupId: number }
// Output: Server-Sent Events with JSON payloads per phase:
//   phase:research   → { phase, message }
//   phase:generate   → { phase, message }
//   phase:availability → { phase, checked, total, available, message }
//   phase:domain_found → { phase, domain: { name, price, available } }
//   phase:workspace   → { phase, checked, total, message }
//   phase:complete    → { phase, domains: [...], recommended, domainCount }
//   phase:error       → { phase, message }
// ---------------------------------------------------------------------------

export const maxDuration = 300 // 5 min — workspace checks can be slow

interface AvailableDomain {
  name: string
  price: number
  available: boolean
  google_workspace_available: boolean
  ms365_workspace_available: boolean
}

export async function POST(request: Request) {
  const body = await request.json()
  const { setupId } = body as { setupId?: number }

  if (!setupId) {
    return Response.json({ error: "setupId is required" }, { status: 400 })
  }

  // Capture abort signal from the client (fires when fetch is aborted)
  const signal = request.signal

  // Load setup from DB
  const supabase = createServerClient()
  const { data: setup } = await supabase
    .from("client_setups")
    .select("redirect_url, display_name, client_slug, domain_count")
    .eq("id", setupId)
    .single()

  if (!setup?.redirect_url) {
    return Response.json(
      { error: "Setup not found or missing redirect URL" },
      { status: 404 }
    )
  }

  // Extract domain/company name from redirect_url
  let primaryDomain: string
  try {
    const url = new URL(
      setup.redirect_url.startsWith("http")
        ? setup.redirect_url
        : `https://${setup.redirect_url}`
    )
    primaryDomain = url.hostname.replace(/^www\./, "")
  } catch {
    primaryDomain = setup.redirect_url
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
  }

  const brandName =
    primaryDomain.split(".")[0] || setup.display_name || setup.client_slug

  // Set up SSE stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        if (signal.aborted) return
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          )
        } catch {
          // Controller already closed
        }
      }

      try {
        const domainCount = setup.domain_count ?? 50

        // ── Phase 1: Research ──────────────────────────────────────
        if (signal.aborted) return
        send({
          phase: "research",
          message: `Analyzing ${primaryDomain}...`,
        })

        let companyDescription = ""
        try {
          companyDescription = await researchCompany(
            primaryDomain,
            setup.display_name,
            signal
          )
        } catch (err) {
          if (signal.aborted) return
          console.warn("Exa research failed, continuing with brand name:", err)
          companyDescription = `${setup.display_name} (${primaryDomain})`
        }

        if (signal.aborted) return
        send({
          phase: "research",
          message: `Researched ${primaryDomain}`,
          description: companyDescription.substring(0, 300),
        })

        // ── Phase 2: AI Domain Generation ─────────────────────────
        if (signal.aborted) return
        send({
          phase: "generate",
          message: "Generating domain suggestions...",
        })

        // Smarter candidate count: 2.5x target, no artificial floor
        const targetCandidates = Math.ceil(domainCount * 2.5)

        let candidates: string[]
        try {
          candidates = await generateDomainCandidates(
            brandName,
            companyDescription,
            targetCandidates,
            signal
          )
        } catch (err) {
          if (signal.aborted) return
          send({
            phase: "error",
            message: `AI generation failed: ${err instanceof Error ? err.message : "Unknown error"}`,
          })
          controller.close()
          return
        }

        if (signal.aborted) return
        send({
          phase: "generate",
          message: `Generated ${candidates.length} domain candidates`,
        })

        // ── Phase 3+4: Pipeline — Availability + Workspace ───────
        // Run availability checks and workspace checks concurrently
        // as a producer-consumer pipeline.
        const CONCURRENCY = 40
        const WORKSPACE_BATCH_SIZE = 10
        const TARGET_AVAILABLE = Math.ceil(domainCount * 1.5)
        const fetchOpts = { signal, fastRetry: true }

        const availableDomains: Array<{ name: string; price: number }> = []
        const pendingWorkspace: Array<{ name: string; price: number }> = []
        const finalDomains: AvailableDomain[] = []
        let checked = 0
        let availabilityDone = false
        let wsChecked = 0

        send({
          phase: "availability",
          checked: 0,
          total: candidates.length,
          available: 0,
          message: `Checking availability (0/${candidates.length})...`,
        })

        // Producer: availability checks
        const availabilityProducer = async () => {
          for (let i = 0; i < candidates.length; i += CONCURRENCY) {
            if (signal.aborted) break
            if (availableDomains.length >= TARGET_AVAILABLE) {
              send({
                phase: "availability",
                checked,
                total: checked,
                available: availableDomains.length,
                message: `Found ${availableDomains.length} available — skipping remaining`,
              })
              break
            }

            const batch = candidates.slice(i, i + CONCURRENCY)
            const results = await Promise.allSettled(
              batch.map(async (domain) => {
                try {
                  const result = await checkDomainAvailable(domain, fetchOpts)
                  return { domain, result }
                } catch {
                  return { domain, result: null }
                }
              })
            )

            for (const r of results) {
              checked++
              if (r.status === "fulfilled" && r.value.result) {
                const { domain, result } = r.value
                if (result.available && !result.banned) {
                  const price = result.registration_price ?? 9
                  const entry = { name: domain, price }
                  availableDomains.push(entry)
                  pendingWorkspace.push(entry)
                  send({
                    phase: "domain_found",
                    domain: { name: domain, price, available: true },
                  })
                }
              }
            }

            send({
              phase: "availability",
              checked,
              total: candidates.length,
              available: availableDomains.length,
              message: `Checking availability (${checked}/${candidates.length})...`,
            })
          }
          availabilityDone = true
        }

        // Consumer: workspace checks (runs concurrently with availability)
        const workspaceConsumer = async () => {
          let sentFirstEvent = false
          while (true) {
            if (signal.aborted) break

            const hasFullBatch = pendingWorkspace.length >= WORKSPACE_BATCH_SIZE
            const hasFinalBatch =
              availabilityDone && pendingWorkspace.length > 0

            if (hasFullBatch || hasFinalBatch) {
              const batch = pendingWorkspace.splice(0, WORKSPACE_BATCH_SIZE)

              // Send initial workspace event so UI transitions from availability → workspace
              if (!sentFirstEvent) {
                sentFirstEvent = true
                send({
                  phase: "workspace",
                  checked: 0,
                  total: availableDomains.length,
                  message: `Verifying email workspace compatibility (0/${availableDomains.length})...`,
                })
              }

              try {
                const wsResults = await checkWorkspaceAvailability(
                  batch.map((d) => d.name),
                  fetchOpts
                )
                for (const ws of wsResults) {
                  const domainInfo = batch.find((d) => d.name === ws.domain)
                  finalDomains.push({
                    name: ws.domain,
                    price: domainInfo?.price ?? 9,
                    available: true,
                    google_workspace_available: ws.google_workspace_available,
                    ms365_workspace_available: ws.ms365_workspace_available,
                  })
                }
              } catch (err) {
                console.warn("Workspace check batch failed:", err)
                // Fallback: assume workspace available
                for (const d of batch) {
                  finalDomains.push({
                    name: d.name,
                    price: d.price,
                    available: true,
                    google_workspace_available: true,
                    ms365_workspace_available: true,
                  })
                }
              }

              wsChecked += batch.length
              send({
                phase: "workspace",
                checked: wsChecked,
                total: availableDomains.length,
                message: `Verifying email workspace compatibility (${wsChecked}/${availableDomains.length})...`,
              })
            } else if (availabilityDone && pendingWorkspace.length === 0) {
              break
            } else {
              // Poll: wait briefly for more domains to arrive
              await new Promise((r) => setTimeout(r, 200))
            }
          }
        }

        await Promise.all([availabilityProducer(), workspaceConsumer()])

        if (signal.aborted) return

        if (finalDomains.length === 0) {
          send({
            phase: "complete",
            domains: [],
            message: "No available domains found. Try a different brand name.",
          })
          controller.close()
          return
        }

        // ── Phase 5: Complete ─────────────────────────────────────
        const recommended = finalDomains
          .slice(0, domainCount)
          .map((d) => d.name)

        send({
          phase: "complete",
          domains: finalDomains,
          recommended,
          domainCount,
          message: `Found ${finalDomains.length} available domains`,
        })
      } catch (err) {
        if (signal.aborted) return
        send({
          phase: "error",
          message:
            err instanceof Error ? err.message : "Domain search failed",
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Research a company using Exa search API. */
async function researchCompany(
  domain: string,
  displayName: string,
  signal?: AbortSignal
): Promise<string> {
  const apiKey = process.env.EXA_API_KEY
  if (!apiKey) {
    return `${displayName} (${domain})`
  }

  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `"${displayName}" OR "${domain}" company products services industry`,
      numResults: 5,
      type: "auto",
      contents: { text: { maxCharacters: 2000 } },
    }),
    signal,
  })

  if (!res.ok) {
    throw new Error(`Exa search failed: ${res.status}`)
  }

  const data = await res.json()
  const texts = (data.results ?? [])
    .map((r: { text?: string }) => r.text ?? "")
    .filter(Boolean)
    .join("\n\n")

  if (!texts) {
    return `${displayName} (${domain})`
  }

  return texts.substring(0, 2000)
}

/** Use AI to generate domain name candidates with retry on timeout. */
async function generateDomainCandidates(
  brandName: string,
  companyDescription: string,
  targetCount: number = 120,
  parentSignal?: AbortSignal
): Promise<string[]> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not configured")
  }

  const prompt = `You are a domain name expert. A company needs .com domains for cold email outbound sending infrastructure. These domains should look like they could be legitimate properties of this company — related to what they actually do.

COMPANY BRAND: "${brandName}"
COMPANY INFO: ${companyDescription.substring(0, 1500)}

TASK: Based on the company description above, first identify:
- What industry/vertical they are in
- What their core products/services are
- Key terms associated with their business

Then generate exactly ${targetCount} unique .com domain names.

DOMAIN MIX (important — follow these proportions):
- ~50% INDUSTRY-SPECIFIC: brand + words relevant to their actual business (e.g. for a 3D visualization company: ${brandName}render.com, ${brandName}visual.com, ${brandName}studio.com)
- ~25% UNIVERSAL GOOD WORDS: brand + proven high-quality generic words that work for any company. Use words like: digital, hub, hq, labs, works, studio, central, base, platform, space, cloud, media, zone, tech, group, team, connect, global, core, net, now, one, pro, plus, app, live, go, io, ai, dev, sys, dash, flow, link, up, way
- ~25% PREFIX PATTERN: put a short word BEFORE the brand instead of after. Short words work best as prefixes. Examples: go${brandName}.com, my${brandName}.com, get${brandName}.com, try${brandName}.com, use${brandName}.com, the${brandName}.com, hey${brandName}.com, hi${brandName}.com, all${brandName}.com, we${brandName}.com, on${brandName}.com, at${brandName}.com

RULES:
1. ALL domains must end in .com
2. ALL domains must contain "${brandName}" or a recognizable abbreviation of it
3. Keep domains short (under 20 characters before .com)
4. Make them look like plausible company subbrands or products
5. For the prefix pattern (~25%): put the modifier word BEFORE "${brandName}" (e.g. go${brandName}.com, hub${brandName}.com). Short 2-4 letter prefixes work best.
6. For the suffix pattern (~75%): put the modifier word AFTER "${brandName}" (e.g. ${brandName}digital.com, ${brandName}hub.com)
7. Avoid spammy words like: sales, ads, growth, boost, lead, market, promo, deal, cheap, best, top, free
8. Maximize variety — don't repeat the same modifier with different brand abbreviations

Return ONLY a valid JSON array of ${targetCount} domain names. No explanation, no markdown, just the JSON array.`

  // Retry once on timeout/failure
  let lastError: Error | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // 45-second hard timeout on AI generation, combined with parent signal
      const timeoutSignal = AbortSignal.timeout(45_000)
      const combinedSignal = parentSignal
        ? AbortSignal.any([parentSignal, timeoutSignal])
        : timeoutSignal

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "xiaomi/mimo-v2.5",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 4096,
          temperature: 0.8,
        }),
        signal: combinedSignal,
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`OpenRouter failed (${res.status}): ${text.substring(0, 200)}`)
      }

      const data = await res.json()
      const content = data.choices?.[0]?.message?.content ?? ""

      // Extract JSON array from response (handle markdown code blocks)
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        throw new Error("AI did not return a valid JSON array")
      }

      let domains: string[]
      try {
        domains = JSON.parse(jsonMatch[0])
      } catch {
        throw new Error("Failed to parse AI domain suggestions")
      }

      return domains
        .map((d: string) => d.toLowerCase().trim())
        .filter(
          (d: string) =>
            d.endsWith(".com") &&
            d.length > 5 &&
            d.length < 60 &&
            /^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.com$/.test(d)
        )
        .slice(0, targetCount + 30)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      // Don't retry if the parent (client) aborted
      if (parentSignal?.aborted) throw lastError
      // Retry on first attempt
      if (attempt === 0) continue
      throw lastError
    }
  }

  throw lastError ?? new Error("AI generation failed")
}
