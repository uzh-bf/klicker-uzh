import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedManageUserId } from '../../../../../lib/server/manageAuth'
import {
  confirmManageProposal,
  getRequiredManageOrigin,
  verifyManageProposalToken,
} from '../../../../../services/manageProposals'

export const runtime = 'nodejs'

const confirmProposalSchema = z.object({
  proposalToken: z.string().trim().min(1),
})

function getGraphqlEndpoint() {
  const origin = process.env.APP_ORIGIN_API?.replace(/\/$/, '')
  return `${origin ?? 'http://localhost:3000'}/api/graphql`
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedManageUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
  try {
    manageOrigin = getRequiredManageOrigin()
  } catch {
    return NextResponse.json(
      { error: 'Proposal confirmation is not configured' },
      { status: 500 }
    )
  }

  if (!secret || !issuer) {
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

    return NextResponse.json(
      await confirmManageProposal({
        graphqlEndpoint: getGraphqlEndpoint(),
        manageOrigin,
        proposal,
        sessionToken,
      })
    )
  } catch (error) {
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
