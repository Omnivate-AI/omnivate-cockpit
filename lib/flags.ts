/**
 * Feature flags for the cockpit.
 *
 * Legacy-bound features stay OFF until their control-plane primitives are
 * re-wired to the sp_* model (Build 5+). The app is a read-only cockpit on
 * the shared sp_* data layer until then; the plugins remain the only
 * writers/actors against Smartlead and InboxKit.
 */
export const FLAGS = {
  /** Onboarding wizard writes client_setups/setup_steps — no sp_* backend. */
  onboarding: false,
  /**
   * Legacy infra lifecycle actions (rotate / drain / rest / order / master)
   * that dispatch Trigger.dev tasks against the retired mailbox_* model.
   * Superseded by the granular Build-5 flags below — kept false.
   */
  infraActions: false,
  /** Campaign pause/resume previously called Smartlead live (DEF-2). */
  campaignActions: false,
  /** Pipeline run button dispatches Trigger.dev run-pipeline (still valid). */
  pipelineActions: true,

  // --- Build-5: actions from the UI, via the email-infra plugin's
  //     sp_decisions contract (R11). The plugin engines stay the only
  //     actors against Smartlead/InboxKit; the cockpit writes + approves
  //     decision rows in the plugin's own vocabulary. ---

  /** 5.0 — read-only Decisions panel on the Mailboxes tab. Detection only. */
  infraDecisions: true,
  /**
   * 5.1a — in-app Approve/Deny on sp_decisions. Writes the SAME
   * status='approved'/'denied' the Slack button writes. NEVER spends —
   * approval only marks; the actual order placement is a separate
   * supervised place-step (order-engine). Idempotent (resolves once).
   */
  infraDecisionApprove: true,
  /**
   * 5.1b — "Request order" writes a pending order_mailboxes decision
   * (same decision_type the order-engine + Slack understand). NEVER spends;
   * a supervised order-engine run sizes the bench gap + places after approval.
   */
  infraOrderRequest: true,
  /**
   * 5.1c — "Flag as burnt → queue swap": sets sp_mailboxes.lifecycle_status
   * = 'burnt' so the next SUPERVISED handle-burn run drains the box + swaps
   * in a reserve. This is the ONLY real "swap in reserves" trigger (swaps
   * are not decision-driven). It writes plugin LIFECYCLE state — a boundary
   * beyond decision-writes — so it ships DARK until Amzat/Omar sign off on
   * the cockpit writing lifecycle. Flip to true to enable.
   */
  infraSwapEscalate: false,
} as const

export const DISABLED_ACTION_MESSAGE =
  "Disabled in this build — control-plane actions are re-wired to the sp_* model in a later build."
