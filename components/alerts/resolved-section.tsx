"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { AlertTable } from "./alert-table"
import { cn } from "@/lib/utils"
import type { AlertWithDomain } from "@/lib/queries"

interface ResolvedSectionProps {
  alerts: AlertWithDomain[]
  count: number
}

export function ResolvedSection({ alerts, count }: ResolvedSectionProps) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-stone-50 dark:hover:bg-accent/50 transition-colors rounded-t-xl">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Resolved Alerts</CardTitle>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-stone-100 dark:bg-accent px-1.5 text-xs font-medium text-muted-foreground">
                {count}
              </span>
              <ChevronDown
                className={cn(
                  "ml-auto h-4 w-4 text-muted-foreground transition-transform duration-200",
                  open && "rotate-180"
                )}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            <AlertTable alerts={alerts} resolved />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
