"use client"

// Phase B: read-only. Drain/rotate actions will be routed through the decision
// queue in Phase F once mailbox_decisions + execute-decision are wired up.
// For now the table shows state only — no direct actions.

import type { ClientMailboxRow } from "@/lib/queries/mailboxes"

interface MailboxActionsProps {
  mailbox: ClientMailboxRow
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function MailboxActions(_props: MailboxActionsProps) {
  return null
}
