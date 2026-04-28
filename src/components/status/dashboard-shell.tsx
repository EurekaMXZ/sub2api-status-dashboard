"use client"

import { startTransition, useEffect, useEffectEvent, useState } from "react"

import { AnimatedMetricValue } from "@/components/status/animated-metric-value"
import type { StatusDashboardData } from "@/lib/sub2api-status"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const POLL_INTERVAL_MS = 5_000
const METRIC_VALUE_CLASS =
  "max-w-full whitespace-nowrap text-center font-mono text-[clamp(2rem,2.7vw,2.9rem)] leading-[0.92] tracking-[-0.045em] text-white tabular-nums"
const COUNT_FORMATTER = new Intl.NumberFormat("en-US")

function hasRenderableValue(data: StatusDashboardData) {
  return (
    data.tokens.today !== null ||
    data.tokens.all !== null ||
    data.requests.today !== null ||
    data.requests.all !== null ||
    data.pool !== null ||
    data.sla24h !== null
  )
}

function formatCount(value: number) {
  return COUNT_FORMATTER.format(Math.round(value))
}

function normalizePercentValue(value: number | null) {
  if (typeof value !== "number") {
    return null
  }

  return value <= 1 ? value * 100 : value
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`
}

async function fetchStatusDashboardData(): Promise<StatusDashboardData> {
  const response = await fetch("/api/status", {
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`status route failed: ${response.status}`)
  }

  return (await response.json()) as StatusDashboardData
}

function MetricCard({
  label,
  value,
  formatValue,
  className,
}: {
  label: string
  value: number | null
  formatValue: (value: number) => string
  className?: string
}) {
  return (
    <Card
      size="sm"
      className={cn(
        "min-h-[176px] justify-between border-0 bg-white/[0.04] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-white/10 backdrop-blur-xl",
        className
      )}
    >
      <CardHeader className="gap-3">
        <CardTitle className="font-mono text-[10px] tracking-[0.34em] text-white/45 uppercase">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-1 items-center justify-center pt-5 pb-2">
        <AnimatedMetricValue
          className={METRIC_VALUE_CLASS}
          formatValue={formatValue}
          value={value}
        />
      </CardContent>
    </Card>
  )
}

export function DashboardShell({
  initialData,
}: {
  initialData: StatusDashboardData
}) {
  const [data, setData] = useState(initialData)

  const refreshData = useEffectEvent(async () => {
    if (document.visibilityState === "hidden") {
      return
    }

    try {
      const nextData = await fetchStatusDashboardData()
      startTransition(() => {
        setData(nextData)
      })
    } catch (error) {
      console.error("[status-dashboard] client refresh failed", error)
    }
  })

  useEffect(() => {
    if (!hasRenderableValue(initialData)) {
      void refreshData()
    }

    const intervalId = window.setInterval(() => {
      void refreshData()
    }, POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [initialData])

  const poolLabel = data.groupName
    ? `可用号池 · ${data.groupName}`
    : "可用号池"

  return (
    <div className="w-full">
      <section className="grid gap-3 xl:grid-cols-10 xl:justify-end">
        <MetricCard
          label="今日 Token 数"
          value={data.tokens.today}
          formatValue={formatCount}
          className="xl:col-span-4"
        />
        <MetricCard
          label="今日请求数"
          value={data.requests.today}
          formatValue={formatCount}
          className="xl:col-span-3"
        />
        <MetricCard
          label="24小时可用性"
          value={normalizePercentValue(data.sla24h)}
          formatValue={formatPercent}
          className="xl:col-span-3"
        />
      </section>

      <section className="mt-3 grid gap-3 xl:grid-cols-10 xl:justify-end">
        <MetricCard
          label="总 Token 数"
          value={data.tokens.all}
          formatValue={formatCount}
          className="xl:col-span-4"
        />
        <MetricCard
          label="总请求数"
          value={data.requests.all}
          formatValue={formatCount}
          className="xl:col-span-3"
        />
        <MetricCard
          label={poolLabel}
          value={data.pool}
          formatValue={formatCount}
          className="xl:col-span-3"
        />
      </section>
    </div>
  )
}
