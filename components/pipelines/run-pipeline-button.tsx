"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Play, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

interface RunPipelineButtonProps {
  pipelineId: number
  client: string
  pipelineName: string
}

export function RunPipelineButton({ pipelineId, client, pipelineName }: RunPipelineButtonProps) {
  const [open, setOpen] = useState(false)
  const [batchId, setBatchId] = useState("")
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleRun() {
    if (!batchId.trim()) return

    setRunning(true)
    setError(null)

    try {
      const res = await fetch("/api/tasks/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: "run-pipeline",
          payload: {
            pipelineId,
            batchId: batchId.trim(),
            client,
          },
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Failed to trigger pipeline (${res.status})`)
      }

      setOpen(false)
      setBatchId("")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setRunning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Play className="h-3.5 w-3.5" />
          Run Pipeline
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Run Pipeline</DialogTitle>
          <DialogDescription>
            Trigger <span className="font-medium">{pipelineName}</span> for{" "}
            <span className="font-medium">{client}</span>. Enter a batch ID to identify this run.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <label htmlFor="batch-id" className="text-sm font-medium">
              Batch ID
            </label>
            <Input
              id="batch-id"
              placeholder="e.g., rp_us_run4"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && batchId.trim() && !running) {
                  handleRun()
                }
              }}
              disabled={running}
            />
          </div>
          {error && (
            <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={running}>
            Cancel
          </Button>
          <Button onClick={handleRun} disabled={!batchId.trim() || running} className="gap-1.5">
            {running ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Triggering…
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                Run
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
