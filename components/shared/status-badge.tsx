import { LIFECYCLE_STATUS_CONFIG, type LifecycleStatus } from "@/lib/types"

export function StatusBadge({ status }: { status: LifecycleStatus }) {
  const config = LIFECYCLE_STATUS_CONFIG[status]
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color} ${config.bgColor}`}
    >
      {config.label}
    </span>
  )
}
