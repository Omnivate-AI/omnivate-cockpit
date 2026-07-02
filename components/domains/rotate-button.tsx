"use client"

import { useState } from "react"
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RotateDialog } from "./rotate-dialog"

interface RotateButtonProps {
  domainId: number
  domainName: string
  client: string
  accountCount?: number | null
  masterInboxEmail?: string | null
  alertId?: number | null
  variant?: "default" | "destructive" | "outline"
  size?: "default" | "sm"
}

export function RotateButton({
  domainId,
  domainName,
  client,
  accountCount,
  masterInboxEmail,
  alertId,
  variant = "destructive",
  size = "sm",
}: RotateButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <RotateCcw className="h-4 w-4 mr-1.5" />
        Rotate
      </Button>
      <RotateDialog
        domainId={domainId}
        domainName={domainName}
        client={client}
        accountCount={accountCount}
        masterInboxEmail={masterInboxEmail}
        alertId={alertId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
