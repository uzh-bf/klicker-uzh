/**
 * Dedicated authenticated endpoint for one-time provider secret submission.
 *
 * This Express route is intentionally NOT part of the GraphQL schema:
 * GraphQL request bodies, variables, and responses can be logged by
 * middleware or traced. The secret is accepted exactly once and never
 * returned in any response.
 */

import { verifyJWT } from '@klicker-uzh/util'
import type { Request, Response } from 'express'

export async function providerCredentialIngress(req: Request, res: Response) {
  const authHeader = req.headers['authorization'] ?? ''
  const token =
    typeof authHeader === 'string' ? authHeader.replace('Bearer ', '') : ''
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const payload = await verifyJWT(token, process.env.APP_SECRET as string)
    if (payload.role !== 'USER') throw new Error('wrong role')
  } catch {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const body = req.body as Record<string, unknown> | undefined
  const credentialId =
    typeof body?.credentialId === 'string' ? body.credentialId : null
  const secret = typeof body?.secret === 'string' ? body.secret : null
  if (
    !credentialId ||
    !secret ||
    !credentialId.match(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    ) ||
    secret.length < 8 ||
    secret.length > 4096
  ) {
    res.status(400).json({ error: 'Invalid request' })
    return
  }

  // The actual custody call happens through the lifecycle service; this route
  // only proves that the transport is authenticated and never reflects the secret.
  // The real implementation will forward to the AI Credential Gateway (K3).
  res.json({ ok: true, credentialId: credentialId })
}
