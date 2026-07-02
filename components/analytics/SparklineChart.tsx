"use client"

import { BarChart, Bar, ResponsiveContainer, Cell } from "recharts"

interface SparklineChartProps {
  data: number[]
  type: "sends" | "replies"
  target?: number
}

export function SparklineChart({ data, type, target }: SparklineChartProps) {
  const chartData = data.map((value, i) => ({ value, index: i }))

  const getBarColour = (value: number) => {
    if (type === "replies") return "#8b5cf6" // violet
    if (target && value >= target) return "#10b981" // emerald
    if (target && value >= target * 0.6) return "#eab308" // yellow
    if (target && value > 0) return "#ef4444" // red
    return "#e5e7eb" // gray-200
  }

  return (
    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Bar dataKey="value" radius={[1, 1, 0, 0]} animationDuration={800}>
            {chartData.map((entry) => (
              <Cell key={entry.index} fill={getBarColour(entry.value)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
