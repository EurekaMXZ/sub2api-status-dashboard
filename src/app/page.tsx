import { DashboardShell } from "@/components/status/dashboard-shell"
import { StatusFrame } from "@/components/status/status-frame"
import { createStatusDashboardFallback } from "@/lib/sub2api-status"

export const dynamic = "force-dynamic"

export default function Home() {
  const initialData = createStatusDashboardFallback()

  return (
    <StatusFrame>
      <DashboardShell initialData={initialData} />
    </StatusFrame>
  )
}
