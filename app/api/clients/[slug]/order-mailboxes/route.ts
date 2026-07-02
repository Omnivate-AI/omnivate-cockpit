import { DISABLED_ACTION_MESSAGE } from "@/lib/flags"

// Disabled in the sp_* migration build: this route dispatched control-plane
// actions (Trigger.dev / InboxKit / Smartlead) that operate on the retired
// legacy model. Re-wired to sp_*-native primitives in a later build.
const disabled = () =>
  Response.json({ error: DISABLED_ACTION_MESSAGE, disabled: true }, { status: 410 })

export const GET = disabled
export const POST = disabled
export const PUT = disabled
export const PATCH = disabled
export const DELETE = disabled
