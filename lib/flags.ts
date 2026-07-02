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
   * Infra lifecycle actions (rotate / drain / rest / order / master change)
   * dispatch Trigger.dev tasks that operate on the legacy mailbox_* model.
   */
  infraActions: false,
  /** Campaign pause/resume previously called Smartlead live (DEF-2). */
  campaignActions: false,
  /** Pipeline run button dispatches Trigger.dev run-pipeline (still valid). */
  pipelineActions: true,
} as const

export const DISABLED_ACTION_MESSAGE =
  "Disabled in this build — control-plane actions are re-wired to the sp_* model in a later build."
