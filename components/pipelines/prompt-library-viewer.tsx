"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import type { CampaignPrompt, GroupedCampaignPrompts } from "@/lib/queries/pipelines"
import { ChevronDown, ChevronRight, Eye } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

function formatPurpose(purpose: string): string {
  return purpose.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + "…"
}

function PromptCard({ prompt }: { prompt: CampaignPrompt }) {
  const [expanded, setExpanded] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogContent, setDialogContent] = useState<{
    title: string
    text: string
  } | null>(null)

  function openFullPrompt(title: string, text: string) {
    setDialogContent({ title, text })
    setDialogOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full rounded border bg-card p-2.5 text-left hover:bg-accent/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
          <span className="text-sm font-medium truncate">{prompt.name}</span>
          {prompt.model && (
            <code className="text-[10px] font-mono text-muted-foreground bg-muted px-1 py-0.5 rounded shrink-0">
              {prompt.model}
            </code>
          )}
          {prompt.version != null && (
            <span className="text-[10px] text-muted-foreground shrink-0">v{prompt.version}</span>
          )}
          {prompt.persona && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
              {prompt.persona}
            </Badge>
          )}
          {prompt.waterfall_priority != null && (
            <span className="text-[10px] text-muted-foreground shrink-0">
              #{prompt.waterfall_priority}
            </span>
          )}
        </div>

        {expanded && (
          <div className="mt-2 ml-5 space-y-2" onClick={(e) => e.stopPropagation()}>
            {prompt.system_prompt && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    System Prompt
                  </span>
                  {prompt.system_prompt.length > 500 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-[10px]"
                      onClick={() => openFullPrompt("System Prompt", prompt.system_prompt)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View Full
                    </Button>
                  )}
                </div>
                <pre className="rounded bg-gray-100 dark:bg-gray-800 p-2 text-[11px] font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap overflow-hidden">
                  {truncate(prompt.system_prompt, 500)}
                </pre>
              </div>
            )}
            {prompt.user_prompt_template && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    User Prompt Template
                  </span>
                  {prompt.user_prompt_template.length > 500 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-[10px]"
                      onClick={() =>
                        openFullPrompt("User Prompt Template", prompt.user_prompt_template)
                      }
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View Full
                    </Button>
                  )}
                </div>
                <pre className="rounded bg-gray-100 dark:bg-gray-800 p-2 text-[11px] font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap overflow-hidden">
                  {truncate(prompt.user_prompt_template, 500)}
                </pre>
              </div>
            )}
          </div>
        )}
      </button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{dialogContent?.title ?? "Prompt"}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh]">
            <pre className="rounded bg-gray-100 dark:bg-gray-800 p-4 text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {dialogContent?.text}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface PromptLibraryViewerProps {
  groupedPrompts: GroupedCampaignPrompts
  className?: string
}

export function PromptLibraryViewer({ groupedPrompts, className }: PromptLibraryViewerProps) {
  const purposes = Object.keys(groupedPrompts)
  if (purposes.length === 0) return null

  return (
    <div className={cn("space-y-4", className)}>
      <h3 className="text-sm font-semibold">Prompt Library</h3>
      {purposes.map((purpose) => {
        const prompts = groupedPrompts[purpose]
        return (
          <div key={purpose}>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">
              {formatPurpose(purpose)}
            </h4>
            <div className="space-y-1.5">
              {prompts.map((prompt) => (
                <PromptCard key={prompt.id} prompt={prompt} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
