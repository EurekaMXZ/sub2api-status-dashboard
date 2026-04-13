import { getCachedStatusDashboardResult } from "@/lib/sub2api-status"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const result = await getCachedStatusDashboardResult()
    return Response.json(result.data, {
      headers: {
        "X-Status-Cache": result.cacheStatus,
        "X-Status-Cache-Age": String(result.cacheAgeMs),
        "X-Status-Cache-TTL": String(result.ttlMs),
      },
    })
  } catch (error) {
    console.error("[status-dashboard] route handler failed", error)
    return Response.json(
      {
        message: "Failed to load status dashboard data",
      },
      {
        status: 500,
      }
    )
  }
}
