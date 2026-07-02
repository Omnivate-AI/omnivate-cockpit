"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Dashboard error:", error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-rose-50 dark:bg-rose-950/30 p-3">
              <AlertTriangle className="h-6 w-6 text-rose-600 dark:text-rose-400" />
            </div>
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            An error occurred while loading this page. Please try again.
          </p>
          {process.env.NODE_ENV === "development" && (
            <pre className="mb-4 max-h-32 overflow-auto rounded-lg bg-stone-100 dark:bg-stone-900 p-3 text-left text-xs text-muted-foreground">
              {error.message}
            </pre>
          )}
          <Button onClick={reset} className="bg-indigo-600 hover:bg-indigo-700">
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
