import { DashboardShell } from "@/components/status/dashboard-shell"
import { StatusFrame } from "@/components/status/status-frame"
import {
  createStatusDashboardFallback,
  getConfiguredGroupId,
} from "@/lib/sub2api-status"

export const dynamic = "force-dynamic"

export default function Home() {
  const groupId = getConfiguredGroupId()
  const initialData = createStatusDashboardFallback(groupId)

  return (
    <StatusFrame>
      <DashboardShell initialData={initialData} />
    </StatusFrame>
  )
}
