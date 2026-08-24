import { isManageAiEnabled } from '@/src/lib/server/featureFlags'
import { getAuthenticatedManageUser } from '@/src/lib/server/manageAuth'
import {
  confirmManageProposal,
  getRequiredManageOrigin,
  recordProposalConfirmationAudit,
  verifyManageProposalToken,
} from '@/src/services/manageProposals'
import { createRateLimiter } from '@/src/services/rateLimiter'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export const runtime = 'nodejs'

// Best-effort, per-pod limiter (see rateLimiter.ts) — 10 requests / 5 minutes
// per authenticated lecturer. Proposal confirmation is rarer and more
// consequential than plain chat turns, hence the tighter budget.
const confirmRateLimiter = createRateLimiter(10, 5 * 60 * 1000)

const confirmProposalSchema = z.object({
  proposalToken: z.string().trim().min(1),
})

function getGraphqlEndpoint() {
  const origin = process.env.APP_ORIGIN_API?.replace(/\/$/, '')
  if (!origin) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('APP_ORIGIN_API is required')
    }
    console.warn(
      'APP_ORIGIN_API is not set; falling back to http://localhost:3000 for local dev only'
    )
  }
  return `${origin ?? 'http://localhost:3000'}/api/graphql`
}

export async function POST(req: NextRequest) {
  const manageUser = await getAuthenticatedManageUser()
  if (!manageUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = manageUser.sub

  // Proposals can only originate from the lecturer MCP tools, so confirmation
  // follows the same gate. A proposal token minted while the beta was open to
  // this lecturer must not stay redeemable after it is closed again.
  if (!(await isManageAiEnabled(manageUser))) {
    return NextResponse.json({ error: 'Not available' }, { status: 403 })
  }

  const rateLimit = confirmRateLimiter.check(userId)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)),
        },
      }
    )
  }

  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('next-auth.session-token')?.value
  if (!sessionToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = confirmProposalSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const secret = process.env.MCP_LECTURER_JWT_SECRET ?? process.env.APP_SECRET
  const issuer = process.env.APP_ORIGIN_AUTH
  let manageOrigin: string
  let graphqlEndpoint: string
  try {
    manageOrigin = getRequiredManageOrigin()
    graphqlEndpoint = getGraphqlEndpoint()
  } catch (error) {
    console.error('Manage proposal confirmation misconfigured:', error)
    return NextResponse.json(
      { error: 'Proposal confirmation is not configured' },
      { status: 500 }
    )
  }

  if (!secret || !issuer) {
    console.error(
      'Manage proposal confirmation misconfigured: missing MCP_LECTURER_JWT_SECRET/APP_SECRET or APP_ORIGIN_AUTH'
    )
    return NextResponse.json(
      { error: 'Proposal confirmation is not configured' },
      { status: 500 }
    )
  }

  try {
    const proposal = await verifyManageProposalToken(
      parsed.data.proposalToken,
      userId,
      { issuer, secret }
    )

    const confirmation = await confirmManageProposal({
      graphqlEndpoint,
      manageOrigin,
      proposal,
      sessionToken,
    })

    // Best-effort audit record (extension roadmap X5) — never fails the
    // response; persistence above already succeeded.
    await recordProposalConfirmationAudit({
      jti: proposal.jti,
      kind: proposal.kind,
      objectId: String(confirmation.element.id),
      summary: proposal.summary,
      userId,
    })

    return NextResponse.json(confirmation)
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'Manage proposal token already used'
    ) {
      return NextResponse.json(
        { error: 'Proposal already confirmed' },
        { status: 409 }
      )
    }

    if (
      error instanceof Error &&
      error.message === 'Invalid Manage proposal token'
    ) {
      return NextResponse.json({ error: 'Invalid proposal' }, { status: 403 })
    }

    console.error('Manage proposal confirmation failed:', error)
    return NextResponse.json(
      { error: 'Proposal confirmation failed' },
      { status: 502 }
    )
  }
}
