const REQUEST_TIMEOUT_MS = 8_000
const STATUS_CACHE_TTL_MS = 3_000

type StatusCacheEntry = {
  cachedAt: number
  expiresAt: number
  value: StatusDashboardData
}

export type StatusCacheStatus = "hit" | "miss" | "stale"

export type CachedStatusDashboardResult = {
  cacheAgeMs: number
  cacheStatus: StatusCacheStatus
  data: StatusDashboardData
  ttlMs: number
}

type ApiEnvelope<T> = {
  code?: number
  message?: string
  data?: T
}

type DashboardStatsPayload = {
  today_tokens?: number
  total_tokens?: number
  today_requests?: number
  total_requests?: number
}

type DashboardSnapshotV2Payload = {
  stats?: DashboardStatsPayload | null
}

type OpsOverviewPayload = {
  sla?: number | null
}

type AdminGroupPayload = {
  id?: number | null
  name?: string | null
  active_account_count?: number | null
  rate_limited_account_count?: number | null
}

type StatusConfig = {
  baseUrl: string
  adminKey: string
  groupId: number
}

export type StatusDashboardData = {
  groupName: string | null
  tokens: {
    today: number | null
    all: number | null
  }
  requests: {
    today: number | null
    all: number | null
  }
  pool: number | null
  sla24h: number | null
}

function getConfiguredGroupId(): number | null {
  const rawGroupId = process.env.SUB2API_GROUP_ID?.trim()

  if (!rawGroupId) {
    return null
  }

  const parsedGroupId = Number.parseInt(rawGroupId, 10)
  return Number.isInteger(parsedGroupId) && parsedGroupId > 0 ? parsedGroupId : null
}

export function createStatusDashboardFallback(): StatusDashboardData {
  return {
    groupName: null,
    tokens: {
      today: null,
      all: null,
    },
    requests: {
      today: null,
      all: null,
    },
    pool: null,
    sla24h: null,
  }
}

let statusCache: StatusCacheEntry | null = null
let statusCacheInFlight: Promise<CachedStatusDashboardResult> | null = null

function getStatusConfig(): StatusConfig {
  const baseUrl = process.env.SUB2API_BASE_URL?.trim()
  const adminKey = process.env.SUB2API_ADMIN_KEY?.trim()
  const groupId = getConfiguredGroupId()

  if (!baseUrl) {
    throw new Error("Missing SUB2API_BASE_URL")
  }

  if (!adminKey) {
    throw new Error("Missing SUB2API_ADMIN_KEY")
  }

  if (!groupId) {
    throw new Error("Missing or invalid SUB2API_GROUP_ID")
  }

  return {
    baseUrl,
    adminKey,
    groupId,
  }
}

function buildSub2apiUrl(baseUrl: string, pathname: string): URL {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`
  return new URL(pathname.replace(/^\//, ""), normalizedBaseUrl)
}

async function sub2apiGet<T>(
  config: StatusConfig,
  pathname: string,
  searchParams?: Record<string, string | number>
): Promise<T> {
  const url = buildSub2apiUrl(config.baseUrl, pathname)

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, String(value))
    }
  }

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "x-api-key": config.adminKey,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`sub2api request failed: ${response.status} ${response.statusText}`)
  }

  const payload = (await response.json()) as ApiEnvelope<T>

  if (payload.code !== 0 || payload.data === undefined) {
    throw new Error(payload.message || "sub2api returned an invalid payload")
  }

  return payload.data
}

function logFetchFailure(name: string, reason: unknown) {
  console.error(`[status-dashboard] failed to load ${name}`, reason)
}

function getAvailablePoolCapacity(
  groups: AdminGroupPayload[],
  groupId: number
): number | null {
  const group = groups.find((item) => item.id === groupId)

  if (!group) {
    return null
  }

  const activeAccountCount = group.active_account_count
  const rateLimitedAccountCount = group.rate_limited_account_count

  if (
    typeof activeAccountCount !== "number" ||
    typeof rateLimitedAccountCount !== "number"
  ) {
    return null
  }

  return Math.max(activeAccountCount - rateLimitedAccountCount, 0)
}

export async function getStatusDashboardData(): Promise<StatusDashboardData> {
  const config = getStatusConfig()
  const fallback = createStatusDashboardFallback()

  const [snapshotResult, overviewResult, groupsResult] = await Promise.allSettled([
    sub2apiGet<DashboardSnapshotV2Payload>(
      config,
      "/api/v1/admin/dashboard/snapshot-v2",
      {
        include_stats: "true",
        include_trend: "false",
        include_model_stats: "false",
        include_group_stats: "false",
        include_users_trend: "false",
      }
    ),
    sub2apiGet<OpsOverviewPayload>(config, "/api/v1/admin/ops/dashboard/overview", {
      time_range: "24h",
    }),
    sub2apiGet<AdminGroupPayload[]>(config, "/api/v1/admin/groups/all"),
  ])

  if (snapshotResult.status === "fulfilled") {
    const stats = snapshotResult.value.stats
    fallback.tokens.today = stats?.today_tokens ?? null
    fallback.tokens.all = stats?.total_tokens ?? null
    fallback.requests.today = stats?.today_requests ?? null
    fallback.requests.all = stats?.total_requests ?? null
  } else {
    logFetchFailure("dashboard snapshot", snapshotResult.reason)
  }

  if (overviewResult.status === "fulfilled") {
    fallback.sla24h = overviewResult.value.sla ?? null
  } else {
    logFetchFailure("ops overview", overviewResult.reason)
  }

  if (groupsResult.status === "fulfilled") {
    const group = groupsResult.value.find((item) => item.id === config.groupId)
    fallback.groupName = group?.name ?? null
    fallback.pool = getAvailablePoolCapacity(groupsResult.value, config.groupId)
  } else {
    logFetchFailure("groups", groupsResult.reason)
  }

  return fallback
}

export async function getCachedStatusDashboardResult(): Promise<CachedStatusDashboardResult> {
  const now = Date.now()

  if (statusCache && statusCache.expiresAt > now) {
    return {
      cacheAgeMs: now - statusCache.cachedAt,
      cacheStatus: "hit",
      data: statusCache.value,
      ttlMs: STATUS_CACHE_TTL_MS,
    }
  }

  if (statusCacheInFlight) {
    return statusCacheInFlight
  }

  statusCacheInFlight = getStatusDashboardData()
    .then<CachedStatusDashboardResult>((value) => {
      const cachedAt = Date.now()
      statusCache = {
        cachedAt,
        value,
        expiresAt: cachedAt + STATUS_CACHE_TTL_MS,
      }
      return {
        cacheAgeMs: 0,
        cacheStatus: "miss",
        data: value,
        ttlMs: STATUS_CACHE_TTL_MS,
      }
    })
    .catch<CachedStatusDashboardResult>((error) => {
      if (statusCache) {
        return {
          cacheAgeMs: Date.now() - statusCache.cachedAt,
          cacheStatus: "stale",
          data: statusCache.value,
          ttlMs: STATUS_CACHE_TTL_MS,
        }
      }

      throw error
    })
    .finally(() => {
      statusCacheInFlight = null
    })

  return statusCacheInFlight
}
