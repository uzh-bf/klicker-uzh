import { type NextRequest, NextResponse } from 'next/server'
import { isManageAiEnabled } from '@/src/lib/server/featureFlags'
import { getAuthenticatedManageUser } from '@/src/lib/server/manageAuth'
import { loadLecturerMcpTools } from '@/src/services/lecturerMcp'
import type { ManageAssistantCapabilityState } from '@/src/services/manageAssistantCapabilities'
import { createRateLimiter } from '@/src/services/rateLimiter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Keep the server budget below the browser's five-second preflight deadline so
// a bounded 503 can reach the client before its own request aborts.
export const MANAGE_CAPABILITY_TIMEOUT_MS = 3_000

// Best-effort, per-pod guard against repeated authenticated MCP preflights.
const capabilityRateLimiter = createRateLimiter(30, 5 * 60 * 1000)

function capabilityResponse(
  state: ManageAssistantCapabilityState,
  status = 200,
  headers?: HeadersInit
) {
  return NextResponse.json(
    { state },
    {
      headers: { 'Cache-Control': 'private, no-store', ...headers },
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

    const rateLimit = capabilityRateLimiter.check(manageUser.sub)
    if (!rateLimit.allowed) {
      return capabilityResponse('unavailable', 429, {
        'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)),
      })
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

    const response = capabilityResponse(lecturerMcp.capabilityState)
    // The inventory is complete; teardown must not extend the response budget.
    void lecturerMcp.close()
    return response
  } catch {
    console.warn('Manage assistant capability preflight is unavailable')
    return capabilityResponse('unavailable', 503)
  }
}
