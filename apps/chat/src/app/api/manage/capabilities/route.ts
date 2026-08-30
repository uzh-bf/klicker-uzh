import { type NextRequest, NextResponse } from 'next/server'
import { isManageAiEnabled } from '@/src/lib/server/featureFlags'
import { getAuthenticatedManageUser } from '@/src/lib/server/manageAuth'
import { loadLecturerMcpTools } from '@/src/services/lecturerMcp'
import type { ManageAssistantCapabilityState } from '@/src/services/manageAssistantCapabilities'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const MANAGE_CAPABILITY_TIMEOUT_MS = 3_000

function capabilityResponse(
  state: ManageAssistantCapabilityState,
  status = 200
) {
  return NextResponse.json(
    { state },
    {
      headers: { 'Cache-Control': 'private, no-store' },
      status,
    }
  )
}

export async function GET(req: NextRequest) {
  const manageUser = await getAuthenticatedManageUser()
  if (!manageUser) return capabilityResponse('unavailable', 401)

  try {
    if (!(await isManageAiEnabled(manageUser))) {
      return capabilityResponse('unavailable', 403)
    }

    const signal = AbortSignal.any([
      req.signal,
      AbortSignal.timeout(MANAGE_CAPABILITY_TIMEOUT_MS),
    ])
    const lecturerMcp = await loadLecturerMcpTools(
      manageUser.sub,
      manageUser.scope,
      undefined,
      signal
    )

    try {
      return capabilityResponse(lecturerMcp.capabilityState)
    } finally {
      await lecturerMcp.close()
    }
  } catch {
    console.warn('Manage assistant capability preflight is unavailable')
    return capabilityResponse('unavailable', 503)
  }
}
