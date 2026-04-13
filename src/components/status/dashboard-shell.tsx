"use client"

import { startTransition, useEffect, useEffectEvent, useState } from "react"

import type { StatusDashboardData } from "@/lib/sub2api-status"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const POLL_INTERVAL_MS = 30_000
const METRIC_VALUE_CLASS =
  "max-w-full whitespace-nowrap text-center font-mono text-[clamp(2rem,2.7vw,2.9rem)] leading-[0.92] tracking-[-0.045em] text-white tabular-nums"

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

function formatCount(value: number | null) {
  if (typeof value !== "number") {
    return "--"
  }

  return new Intl.NumberFormat("en-US").format(Math.round(value))
}

function formatPercent(value: number | null) {
  if (typeof value !== "number") {
    return "--"
  }

  const normalizedValue = value <= 1 ? value * 100 : value
  return `${normalizedValue.toFixed(2)}%`
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
  className,
}: {
  label: string
  value: string
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
        <div className={METRIC_VALUE_CLASS}>{value}</div>
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

  const poolLabel = data.groupId ? `POOL · G${data.groupId}` : "POOL"

  return (
    <div className="w-full">
      <section className="grid gap-3 xl:grid-cols-10 xl:justify-end">
        <MetricCard
          label="24小时 Token 数"
          value={formatCount(data.tokens.today)}
          className="xl:col-span-4"
        />
        <MetricCard
          label="24小时请求数"
          value={formatCount(data.requests.today)}
          className="xl:col-span-3"
        />
        <MetricCard
          label="24小时可用性"
          value={formatPercent(data.sla24h)}
          className="xl:col-span-3"
        />
      </section>

      <section className="mt-3 grid gap-3 xl:grid-cols-10 xl:justify-end">
        <MetricCard
          label="总 Token 数"
          value={formatCount(data.tokens.all)}
          className="xl:col-span-4"
        />
        <MetricCard
          label="总请求数"
          value={formatCount(data.requests.all)}
          className="xl:col-span-3"
        />
        <MetricCard
          label={poolLabel.replace("POOL", "可用号池")}
          value={formatCount(data.pool)}
          className="xl:col-span-3"
        />
      </section>
    </div>
  )
}
