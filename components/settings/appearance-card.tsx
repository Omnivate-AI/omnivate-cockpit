"use client"

import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useEffect, useState } from "react"

export function AppearanceCard() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = mounted && theme === "dark"

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {isDark ? (
            <Moon className="h-5 w-5 text-indigo-500" />
          ) : (
            <Sun className="h-5 w-5 text-amber-500" />
          )}
          <CardTitle className="text-lg">Appearance</CardTitle>
        </div>
        <CardDescription>Choose your preferred color scheme</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <Label htmlFor="theme-toggle" className="flex flex-col gap-1">
            <span>Dark mode</span>
            <span className="text-sm text-muted-foreground font-normal">
              {mounted ? (isDark ? "Dark theme active" : "Light theme active") : "Loading..."}
            </span>
          </Label>
          <Switch
            id="theme-toggle"
            checked={isDark}
            onCheckedChange={(checked) =>
              setTheme(checked ? "dark" : "light")
            }
            disabled={!mounted}
          />
        </div>
      </CardContent>
    </Card>
  )
}
