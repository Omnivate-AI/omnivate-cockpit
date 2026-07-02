"use client"

import { RefreshCw, Database, FolderSync, MoreVertical, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTaskTrigger } from "@/hooks/use-task-trigger"

const ACTIONS = [
  {
    taskId: "refresh-client-analytics",
    label: "Refresh Analytics",
    icon: RefreshCw,
  },
  {
    taskId: "sync-mailbox-inventory",
    label: "Sync Mailboxes",
    icon: Database,
  },
  {
    taskId: "sync-campaign-registry",
    label: "Sync Campaigns",
    icon: FolderSync,
  },
] as const

interface ClientActionsDropdownProps {
  clientSlug: string
}

export function ClientActionsDropdown({ clientSlug }: ClientActionsDropdownProps) {
  const analytics = useTaskTrigger()
  const mailboxes = useTaskTrigger()
  const campaigns = useTaskTrigger()

  const triggers = [analytics, mailboxes, campaigns] as const
  const anyRunning = triggers.some((t) => t.isRunning)

  function handleAction(index: number) {
    const action = ACTIONS[index]
    const hook = triggers[index]
    hook.trigger(action.taskId, { clientSlug })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" disabled={anyRunning}>
          {anyRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreVertical className="h-4 w-4" />
          )}
          <span className="sr-only">Client actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {ACTIONS.map((action, i) => {
          const Icon = action.icon
          const isRunning = triggers[i].isRunning
          return (
            <DropdownMenuItem
              key={action.taskId}
              onClick={() => handleAction(i)}
              disabled={anyRunning}
            >
              {isRunning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Icon className="mr-2 h-4 w-4" />
              )}
              {action.label}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
