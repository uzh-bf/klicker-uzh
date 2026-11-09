import { prisma } from '@klicker-uzh/prisma'
import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { PARTICIPANT_COOKIE_NAME } from '@/lib/constants'
import { decode as jwtDecode } from '@/lib/jwt'
import { authEvent } from '@/lib/telemetry'

// Fixed participant session lookup.
//
// This endpoint always interprets the request with the participant
// configuration: it reads only the participant session cookie, rejects
// empty/invalid tokens, and never accepts a manager (lecturer) session as
// participant authentication. It exists so the assessment login UI can
// determine the actual session principal without the generic
// /api/auth/session endpoint, whose configuration depends on dispatch.
//
// Expected authentication invalidity — no cookie, an unverifiable or expired
// token, or no matching participant row — answers 200 with `participant: null`.
// A lookup that fails for infrastructure reasons (database unreachable, timeout,
// unexpected driver error) answers 503 instead: the service did not establish
// the session status, and reporting that as "not signed in" would send a student
// with a valid session through authentication again.
//
// Responses are never cacheable.

interface ParticipantPrincipal {
  id: string
  email: string | null
}

function requestId(req: NextApiRequest): string {
  const header = req.headers['x-request-id']
  return (
    (Array.isArray(header) ? header[0] : header) ??
    `na-${crypto.randomBytes(6).toString('hex')}`
  )
}

// Diagnostics stay limited to a stable identifier: Prisma error codes describe
// the failure class (for example P1001 for an unreachable database) without
// carrying connection details or participant data into the log.
function diagnosticCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code
    if (typeof code === 'string' && code.length <= 32) return code
  }
  return error instanceof Error ? error.name : 'unknown'
}

function readSessionToken(req: NextApiRequest): string | null {
  const chunks = Object.entries(req.cookies ?? {})
    .filter(
      ([name]) =>
        name === PARTICIPANT_COOKIE_NAME ||
        name.startsWith(`${PARTICIPANT_COOKIE_NAME}.`)
    )
    .sort(([a], [b]) => {
      const aSuffix = Number.parseInt(a.split('.').pop() ?? '0', 10) || 0
      const bSuffix = Number.parseInt(b.split('.').pop() ?? '0', 10) || 0
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

  const token = readSessionToken(req)
  if (!token) {
    res.status(200).json({ participant: null })
    return
  }

  let decoded: { sub?: string; role?: string } | null = null
  try {
    decoded = (await jwtDecode({
      token,
      secret: process.env.APP_SECRET ?? '',
    })) as { sub?: string; role?: string } | null
  } catch {
    // Invalid or expired token: report the absence of a participant session
    // instead of leaking verification details.
    decoded = null
  }

  // Require a valid participant identity: an empty or invalidated payload, or
  // any non-participant role (including a manager session), is not participant
  // authentication.
  if (decoded?.role !== 'PARTICIPANT' || !decoded?.sub) {
    res.status(200).json({ participant: null })
    return
  }

  let participant: ParticipantPrincipal | null
  try {
    participant = await prisma.participant.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true },
    })
  } catch (error) {
    authEvent('auth.student_session_lookup', requestId(req), {
      audience: 'participant',
      outcome: 'infrastructure_error',
      errorCategory: diagnosticCode(error),
    })
    // The client must be able to distinguish "no session" from "could not
    // check" and offer a retry instead of a fresh authentication attempt.
    res.setHeader('Retry-After', '5')
    res.status(503).json({ error: 'session_lookup_unavailable' })
    return
  }

  res.status(200).json({ participant: participant ?? null })
}
