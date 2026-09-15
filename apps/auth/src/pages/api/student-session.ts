import { prisma } from '@klicker-uzh/prisma'
import type { NextApiRequest, NextApiResponse } from 'next'
import { PARTICIPANT_COOKIE_NAME } from '@/lib/constants'
import { decode as jwtDecode } from '@/lib/jwt'

// Fixed participant session lookup.
//
// This endpoint always interprets the request with the participant
// configuration: it reads only the participant session cookie, rejects
// empty/invalid tokens, and never accepts a manager (lecturer) session as
// participant authentication. It exists so the assessment login UI can
// determine the actual session principal without the generic
// /api/auth/session endpoint, whose configuration depends on dispatch.
// Responses are never cacheable.

interface ParticipantPrincipal {
  id: string
  email: string | null
}

function readSessionToken(req: NextApiRequest): string | null {
  const chunks = Object.entries(req.cookies ?? {})
    .filter(
      ([name]) =>
        name === PARTICIPANT_COOKIE_NAME ||
        name.startsWith(`${PARTICIPANT_COOKIE_NAME}.`)
    )
    .sort(([a], [b]) => {
      const aSuffix = parseInt(a.split('.').pop() ?? '0', 10) || 0
      const bSuffix = parseInt(b.split('.').pop() ?? '0', 10) || 0
      return aSuffix - bSuffix
    })
  if (chunks.length === 0) return null
  return chunks.map(([, value]) => value).join('')
}

export default async function studentSession(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Pragma', 'no-cache')

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.status(405).json({ participant: null })
    return
  }

  try {
    const token = readSessionToken(req)
    if (!token) {
      res.status(200).json({ participant: null })
      return
    }

    const decoded = (await jwtDecode({
      token,
      secret: process.env.APP_SECRET ?? '',
    })) as { sub?: string; role?: string; email?: string } | null

    // Require a valid participant identity: an empty or invalidated payload,
    // or any non-participant role (including a manager session), is not
    // participant authentication.
    if (decoded?.role !== 'PARTICIPANT' || !decoded?.sub) {
      res.status(200).json({ participant: null })
      return
    }

    const participant = await prisma.participant.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true },
    })

    const principal: ParticipantPrincipal | null = participant
      ? { id: participant.id, email: participant.email }
      : null

    res.status(200).json({ participant: principal })
  } catch {
    // Invalid or unverifiable token: report the absence of a participant
    // session instead of leaking verification details.
    res.status(200).json({ participant: null })
  }
}
