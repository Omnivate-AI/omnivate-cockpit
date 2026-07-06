import { RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { RotationCapacityRow } from "@/lib/queries/mailboxes"

/**
 * Rotation-group capacity (Omar 2026-07-06): Group A alone, Group B alone,
 * the whole deployed pool, and the reserve bench — each with box count and
 * emails/day capacity. The on-week group is badged "sending this week"
 * (its boxes are lifecycle active at full caps; the off-week group rests
 * at the 5/day follow-up allowance).
 */
export function RotationCapacityCard({ data }: { data: RotationCapacityRow | null }) {
  if (!data) return null

  const groupAOn =
    data.group_a_boxes > 0 && data.group_a_active_boxes > data.group_a_boxes / 2
  const groupBOn =
    data.group_b_boxes > 0 && data.group_b_active_boxes > data.group_b_boxes / 2
  const hasGroups = data.group_a_boxes > 0 || data.group_b_boxes > 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
          Rotation Groups &amp; Capacity
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          1 week active / 1 week rest — the resting group keeps a small
          follow-up allowance, so its capacity is real but intentionally low
        </p>
      </CardHeader>
      <CardContent>
        {hasGroups ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <GroupStat
              label="Group A"
              boxes={data.group_a_boxes}
              capacity={data.group_a_capacity}
              badge={groupAOn ? "sending this week" : "resting"}
              active={groupAOn}
            />
            <GroupStat
              label="Group B"
              boxes={data.group_b_boxes}
              capacity={data.group_b_capacity}
              badge={groupBOn ? "sending this week" : "resting"}
              active={groupBOn}
            />
            <GroupStat
              label="Whole pool"
              boxes={data.pool_boxes}
              capacity={data.pool_capacity}
              badge="active + resting"
            />
            <GroupStat
              label="Reserve bench"
              boxes={data.reserve_boxes}
              capacity={data.reserve_capacity}
              badge="if deployed"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <GroupStat
              label="Deployed pool"
              boxes={data.pool_boxes}
              capacity={data.pool_capacity}
              badge="no A/B groups assigned"
            />
            <GroupStat
              label="Reserve bench"
              boxes={data.reserve_boxes}
              capacity={data.reserve_capacity}
              badge="if deployed"
            />
          </div>
        )}
        {(data.warming_boxes > 0 || data.ungrouped_pool_boxes > 0) && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {data.warming_boxes > 0 && (
              <span>{data.warming_boxes} warming (not yet counted)</span>
            )}
            {data.ungrouped_pool_boxes > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                {data.ungrouped_pool_boxes} pool box
                {data.ungrouped_pool_boxes !== 1 ? "es" : ""} missing a group
                assignment
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function GroupStat({
  label,
  boxes,
  capacity,
  badge,
  active,
}: {
  label: string
  boxes: number
  capacity: number
  badge?: string
  active?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2",
        active
          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
          : "bg-muted/40"
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {badge && (
          <span
            className={cn(
              "text-[10px]",
              active
                ? "font-medium text-emerald-700 dark:text-emerald-400"
                : "text-muted-foreground"
            )}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums">
        {capacity.toLocaleString()}
        <span className="ml-1 text-[10px] font-normal text-muted-foreground">
          emails/day
        </span>
      </div>
      <div className="text-[11px] tabular-nums text-muted-foreground">
        {boxes.toLocaleString()} box{boxes !== 1 ? "es" : ""}
      </div>
    </div>
  )
}
