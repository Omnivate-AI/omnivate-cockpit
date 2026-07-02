"use client"

import { useState, Suspense } from "react"
import { Sidebar } from "./sidebar"
import { Header } from "./header"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"

interface AppShellProps {
  alertCount: number
  clients: string[]
  children: React.ReactNode
}

function AppShellInner({ alertCount, clients, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-stone-50 dark:bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:shrink-0">
        <Sidebar alertCount={alertCount} clients={clients} />
      </div>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0" aria-describedby={undefined}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar alertCount={alertCount} clients={clients} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setMobileOpen(true)} alertCount={alertCount} clients={clients} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

export function AppShell({ alertCount, clients, children }: AppShellProps) {
  return (
    <Suspense>
      <AppShellInner alertCount={alertCount} clients={clients}>{children}</AppShellInner>
    </Suspense>
  )
}
