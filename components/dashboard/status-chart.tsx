"use client"

import { PieChart, Pie, Cell, Label } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { LIFECYCLE_STATUS_CONFIG, type LifecycleStatus } from "@/lib/types"
import type { StatusDistributionItem } from "@/lib/queries"

const STATUS_CHART_COLORS: Record<LifecycleStatus, string> = {
  provisioning: "hsl(215, 16%, 47%)",
  warming: "hsl(199, 89%, 48%)",
  reserve: "hsl(38, 92%, 50%)",
  ramping: "hsl(217, 91%, 60%)",
  resting: "hsl(173, 58%, 39%)",
  parked: "hsl(240, 5%, 65%)",
  active: "hsl(142, 76%, 36%)",
  burnt: "hsl(347, 77%, 50%)",
  draining: "hsl(25, 95%, 53%)",
  retired: "hsl(220, 9%, 46%)",
  master: "hsl(263, 70%, 50%)",
}

interface StatusChartProps {
  data: StatusDistributionItem[]
}

export function StatusChart({ data }: StatusChartProps) {
  const total = data.reduce((sum, item) => sum + item.count, 0)

  const chartConfig: ChartConfig = Object.fromEntries(
    data.map((item) => [
      item.status,
      {
        label: LIFECYCLE_STATUS_CONFIG[item.status].label,
        color: STATUS_CHART_COLORS[item.status],
      },
    ])
  )

  if (data.length === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center text-muted-foreground text-sm">
        No domain data available
      </div>
    )
  }

  return (
    <ChartContainer config={chartConfig} className="mx-auto aspect-square h-[250px]">
      <PieChart>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel />}
        />
        <Pie
          data={data}
          dataKey="count"
          nameKey="status"
          innerRadius={60}
          outerRadius={90}
          strokeWidth={2}
          stroke="hsl(var(--background))"
        >
          {data.map((item) => (
            <Cell
              key={item.status}
              fill={STATUS_CHART_COLORS[item.status]}
            />
          ))}
          <Label
            content={({ viewBox }) => {
              if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                return (
                  <text
                    x={viewBox.cx}
                    y={viewBox.cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    <tspan
                      x={viewBox.cx}
                      y={viewBox.cy}
                      className="fill-foreground text-3xl font-bold"
                    >
                      {total}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy ?? 0) + 22}
                      className="fill-muted-foreground text-sm"
                    >
                      Domains
                    </tspan>
                  </text>
                )
              }
            }}
          />
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}

export function StatusChartLegend({ data }: StatusChartProps) {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
      {data.map((item) => (
        <div key={item.status} className="flex items-center gap-1.5 text-sm">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: STATUS_CHART_COLORS[item.status] }}
          />
          <span className="text-muted-foreground">
            {LIFECYCLE_STATUS_CONFIG[item.status].label}
          </span>
          <span className="font-medium tabular-nums">{item.count}</span>
        </div>
      ))}
    </div>
  )
}
