/**
 * V4 D2 — layer a pipeline's steps into dependency levels so the UI can draw
 * the TRUE shape of the build: steps in the same level render side-by-side
 * (they can run in parallel), levels flow downward.
 *
 * Level(step) = 0 when it has no dependencies, else 1 + max(level of deps).
 * Dependency sources, in precedence order:
 *   1. `dependencies` — array of step IDs (engine v2/v3)
 *   2. `depends_on_step` — single reference (legacy); matched against step id
 *      first, then step_order (both semantics exist in old rows)
 * Dangling references (deleted/foreign steps) are ignored, and a cycle guard
 * degrades gracefully to level 0 instead of recursing forever.
 *
 * When NO step in the set declares any dependency, the honest reading is a
 * strictly sequential monolith — each step becomes its own level in
 * step_order.
 */

export interface DagStepLike {
  id: number
  step_order: number
  dependencies: number[] | null
  depends_on_step: number | null
}

export function layoutDagLevels<T extends DagStepLike>(steps: T[]): T[][] {
  if (steps.length === 0) return []
  const ordered = [...steps].sort((a, b) => a.step_order - b.step_order)

  const anyDeps = ordered.some(
    (s) => (s.dependencies?.length ?? 0) > 0 || s.depends_on_step != null
  )
  if (!anyDeps) return ordered.map((s) => [s])

  const byId = new Map(ordered.map((s) => [s.id, s]))
  const byOrder = new Map(ordered.map((s) => [s.step_order, s]))

  const depsOf = (s: T): T[] => {
    if (s.dependencies && s.dependencies.length > 0) {
      return s.dependencies
        .map((d) => byId.get(d))
        .filter((t): t is T => t != null && t.id !== s.id)
    }
    if (s.depends_on_step != null) {
      const t = byId.get(s.depends_on_step) ?? byOrder.get(s.depends_on_step)
      return t && t.id !== s.id ? [t] : []
    }
    return []
  }

  const levels = new Map<number, number>()
  const visiting = new Set<number>()
  const levelOf = (s: T): number => {
    const known = levels.get(s.id)
    if (known != null) return known
    if (visiting.has(s.id)) return 0 // cycle guard — shouldn't happen, stay safe
    visiting.add(s.id)
    const ds = depsOf(s)
    const lvl = ds.length > 0 ? 1 + Math.max(...ds.map(levelOf)) : 0
    visiting.delete(s.id)
    levels.set(s.id, lvl)
    return lvl
  }
  ordered.forEach(levelOf)

  const maxLevel = Math.max(...Array.from(levels.values()))
  const bands: T[][] = Array.from({ length: maxLevel + 1 }, () => [])
  for (const s of ordered) bands[levels.get(s.id) ?? 0].push(s)
  return bands.filter((b) => b.length > 0)
}

/** Names of the steps a step waits on — for the "after: …" chip. */
export function dependencyNames<T extends DagStepLike & { name: string }>(
  step: T,
  all: T[]
): string[] {
  const byId = new Map(all.map((s) => [s.id, s]))
  const byOrder = new Map(all.map((s) => [s.step_order, s]))
  if (step.dependencies && step.dependencies.length > 0) {
    return step.dependencies
      .map((d) => byId.get(d)?.name)
      .filter((n): n is string => Boolean(n))
  }
  if (step.depends_on_step != null) {
    const t = byId.get(step.depends_on_step) ?? byOrder.get(step.depends_on_step)
    return t ? [t.name] : []
  }
  return []
}
