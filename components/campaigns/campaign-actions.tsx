"use client"

import { ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface CampaignActionsProps {
  smartleadCampaignId: number
}

/**
 * Campaign quick actions. The permanently-disabled Pause/Resume buttons were
 * removed in V2 Phase 1 (they return when campaign actions are re-wired
 * properly — see FLAGS.campaignActions); until then the only action here is
 * the live "View in Smartlead" external link.
 */
export function CampaignActions({ smartleadCampaignId }: CampaignActionsProps) {
  const smartleadUrl = `https://app.smartlead.ai/app/email-campaign/${smartleadCampaignId}/campaign-details`

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              asChild
            >
              <a href={smartleadUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">View in Smartlead</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
