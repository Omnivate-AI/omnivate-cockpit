// ============================================================================
// INBOXKIT SERVER UTILITY — Web App (Next.js API Routes)
// ============================================================================
// Mirrors trigger/lib/inboxkit.ts but uses standard Error, setTimeout, console.log
// instead of AbortTaskRunError, wait.for, and logger.

const INBOXKIT_BASE_URL = "https://api.inboxkit.com"
const MAX_RETRIES = 2
const RETRY_DELAYS_MS = [5000, 15000]
const FAST_RETRY_DELAYS_MS = [1000, 3000]

function delay(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener("abort", () => {
      clearTimeout(timer)
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"))
    }, { once: true })
  })
}

// ============================================================================
// CORE FETCH
// ============================================================================

/**
 * Make an authenticated InboxKit API call with retry logic and error classification.
 *
 * Error handling:
 * - 401/403 → throw immediately (credentials invalid)
 * - 404 → returns null (resource not found)
 * - 429 → throws (rate limited)
 * - 5xx → retries up to 2 times with backoff (5s, 15s)
 */
export async function inboxkitFetch(
  path: string,
  workspaceUid?: string,
  options?: RequestInit & { fastRetry?: boolean }
): Promise<any> {
  const apiKey = process.env.INBOXKIT_API_KEY
  if (!apiKey) {
    throw new Error("INBOXKIT_API_KEY not configured")
  }

  const url = `${INBOXKIT_BASE_URL}${path}`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    ...((options?.headers as Record<string, string>) || {}),
  }

  if (workspaceUid) {
    headers["X-Workspace-Id"] = workspaceUid
  }

  const retryDelays = options?.fastRetry ? FAST_RETRY_DELAYS_MS : RETRY_DELAYS_MS
  const signal = options?.signal ?? null
  let lastError: unknown

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError")
    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: signal ?? undefined,
      })

      console.log("[InboxKit]", options?.method ?? "GET", path, response.status)

      // 401/403 — credentials invalid, abort
      if (response.status === 401 || response.status === 403) {
        const errorText = await response.text().catch(() => "Auth error")
        throw new Error(
          `InboxKit auth error (${response.status}): ${errorText.substring(0, 200)}`
        )
      }

      // 404 — resource not found
      if (response.status === 404) {
        return null
      }

      // 429 — rate limited
      if (response.status === 429) {
        throw new Error(`InboxKit rate limited (429) on ${path}`)
      }

      // 5xx — retryable server error
      if (response.status >= 500) {
        const errorText = await response.text().catch(() => "Server error")
        const err = new Error(
          `InboxKit server error (${response.status}): ${errorText.substring(0, 200)}`
        )
        lastError = err

        if (attempt < MAX_RETRIES) {
          const delayMs = retryDelays[attempt]
          console.warn(
            `[InboxKit] 5xx error, retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
            path
          )
          await delay(delayMs, signal)
          continue
        }
        throw err
      }

      // Other non-OK statuses
      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error")
        throw new Error(
          `InboxKit error (${response.status}) on ${path}: ${errorText.substring(0, 200)}`
        )
      }

      // Success — parse JSON
      const text = await response.text()
      if (!text) return null

      try {
        return JSON.parse(text)
      } catch {
        return text
      }
    } catch (error) {
      lastError = error

      // Only retry on network errors for remaining attempts
      const isNetworkError =
        error instanceof TypeError ||
        (error instanceof Error &&
          error.message.toLowerCase().includes("fetch error"))

      if (isNetworkError && attempt < MAX_RETRIES) {
        const delayMs = retryDelays[attempt]
        console.warn(
          `[InboxKit] Network error, retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
          error instanceof Error ? error.message : String(error)
        )
        await delay(delayMs, signal)
        continue
      }

      throw error
    }
  }

  throw lastError ?? new Error("InboxKit request failed after all retries")
}

// ============================================================================
// HELPERS — No workspace required
// ============================================================================

/** Get wallet balance. Returns { balance, currency } or similar from InboxKit. */
export async function getWalletBalance(): Promise<any> {
  return inboxkitFetch("/v1/api/billing/wallet")
}

/** Get account/subscription details. */
export async function getAccountDetails(): Promise<any> {
  return inboxkitFetch("/v1/api/billing/subscription")
}

/** Create a new workspace. Returns { uid, name, ... }. */
export async function createWorkspace(
  name: string
): Promise<{ uid: string; [key: string]: unknown }> {
  return inboxkitFetch("/v1/api/workspaces/create", undefined, {
    method: "POST",
    body: JSON.stringify({ name }),
  })
}

// ============================================================================
// HELPERS — Workspace required
// ============================================================================

/** Create a tag in a workspace. Returns { id, name, ... }. */
export async function createTag(
  workspaceUid: string,
  name: string
): Promise<{ id: string; [key: string]: unknown }> {
  return inboxkitFetch("/v1/api/tags", workspaceUid, {
    method: "POST",
    body: JSON.stringify({ name }),
  })
}

/** Search for available domains with Google/MS365 workspace checks. */
export async function searchDomains(
  workspaceUid: string,
  keyword: string,
  opts?: {
    page?: number
    num?: number
    tlds?: string[]
    showUnavailable?: boolean
  }
): Promise<any> {
  return inboxkitFetch("/v1/api/domains/search", workspaceUid, {
    method: "POST",
    body: JSON.stringify({
      keyword,
      page: opts?.page ?? 1,
      num: opts?.num ?? 20,
      tlds: opts?.tlds ?? [".com"],
      show_unavailable: opts?.showUnavailable ?? false,
      check_banned: true,
      check_google_workspace_availability: true,
      check_ms365_workspace_availability: true,
      registration_years: 1,
    }),
  })
}

/** Per-domain result from InboxKit order API. */
export interface OrderDomainResult {
  domain: string
  status: string
  error?: string
  [key: string]: unknown
}

/** InboxKit order response — 201 with per-domain results. */
export interface OrderResult {
  id?: string
  domains?: OrderDomainResult[]
  [key: string]: unknown
}

/** Place an order for domains + mailboxes. */
export async function placeOrder(
  workspaceUid: string,
  orderPayload: {
    contact_details: Record<string, string>
    domains: Array<{
      name: string
      redirect_url: string
      registration_years: number
      mailboxes: Array<{
        email: string
        first_name: string
        last_name: string
        platform: "GOOGLE" | "MICROSOFT"
        sequencer_uid: string
        profile_pic_url: string
      }>
    }>
  }
): Promise<OrderResult> {
  return inboxkitFetch("/v1/api/orders", workspaceUid, {
    method: "POST",
    body: JSON.stringify(orderPayload),
  })
}

/** Set catch-all forwarding on domains. */
export async function setCatchAll(
  workspaceUid: string,
  domainUids: string[],
  email: string
): Promise<any> {
  return inboxkitFetch("/v1/api/domains/catch-all", workspaceUid, {
    method: "POST",
    body: JSON.stringify({ uids: domainUids, email }),
  })
}

/** Set profile picture on a mailbox. */
export async function setProfilePicture(
  workspaceUid: string,
  mailboxUid: string,
  url: string
): Promise<any> {
  return inboxkitFetch(
    `/v1/api/mailboxes/${mailboxUid}/profile-picture`,
    workspaceUid,
    {
      method: "POST",
      body: JSON.stringify({ url }),
    }
  )
}

/** Add a Smartlead sequencer to a workspace. */
export async function addSequencer(
  workspaceUid: string,
  config: {
    name: string
    platform: string
    api_key: string
    enable_warmup: boolean
    warmup_limit: number
    warmup_increment: string
    warmup_replyrate: number
    tags?: string[]
    [key: string]: unknown
  }
): Promise<any> {
  return inboxkitFetch("/v1/api/sequencers/add", workspaceUid, {
    method: "POST",
    body: JSON.stringify(config),
  })
}

/** Check if a specific domain is available for registration (no workspace needed). */
export async function checkDomainAvailable(
  domain: string,
  fetchOpts?: { signal?: AbortSignal; fastRetry?: boolean }
): Promise<{
  available: boolean
  banned: boolean
  registration_price: number
} | null> {
  return inboxkitFetch(
    `/v1/api/domains/available?domain=${encodeURIComponent(domain)}`,
    undefined,
    fetchOpts
  )
}

/** Batch check Google/MS365 workspace availability for domains (no workspace needed). */
export async function checkWorkspaceAvailability(
  domains: string[],
  fetchOpts?: { signal?: AbortSignal; fastRetry?: boolean }
): Promise<
  Array<{
    domain: string
    google_workspace_available: boolean
    ms365_workspace_available: boolean
  }>
> {
  const result = await inboxkitFetch(
    "/v1/api/domains/check-workspace-availability",
    undefined,
    {
      method: "POST",
      body: JSON.stringify({ domains }),
      ...fetchOpts,
    }
  )
  return result?.result ?? []
}

/** Export mailboxes to Smartlead via a sequencer. */
export async function exportToSmartlead(
  workspaceUid: string,
  sequencerUid: string,
  mailboxUids: string[]
): Promise<any> {
  return inboxkitFetch("/v1/api/sequencers/export", workspaceUid, {
    method: "POST",
    body: JSON.stringify({
      sequencer_uid: sequencerUid,
      mailbox_uids: mailboxUids,
    }),
  })
}
