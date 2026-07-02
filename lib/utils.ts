import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCampaignName(name: string): {
  displayName: string
  version: string | null
} {
  let cleaned = name

  // Extract version suffix (e.g. _v5, _v12)
  let version: string | null = null
  const versionMatch = cleaned.match(/_(v\d+)/i)
  if (versionMatch) {
    version = versionMatch[1].toLowerCase()
    cleaned = cleaned.replace(versionMatch[0], "")
  }

  // Replace underscores with spaces
  cleaned = cleaned.replace(/_/g, " ")

  // Remove trailing single-word tokens that look like person names (lowercase, no digits)
  // e.g. "roosterpunk us outbound christie" → "roosterpunk us outbound"
  cleaned = cleaned.replace(/\s+[a-z]+$/i, (match) => {
    const word = match.trim()
    // Keep known meaningful words
    const keep = ["outbound", "inbound", "us", "uk", "eu", "apac", "global", "primary", "test", "sequence", "followup"]
    if (keep.includes(word.toLowerCase())) return match
    return ""
  })

  // Title-case
  cleaned = cleaned
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")

  return { displayName: cleaned || name, version }
}
