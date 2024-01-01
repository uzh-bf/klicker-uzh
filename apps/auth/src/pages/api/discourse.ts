import { UserRole } from '@klicker-uzh/prisma'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getToken } from 'next-auth/jwt'
import crypto from 'node:crypto'
import { COOKIE_NAME, authOptions, decode } from './auth/[...nextauth]'

type ResponseData = {
  redirectURL: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData | {}>
) {
  const session = await getToken({
    req,
    decode,
    cookieName: COOKIE_NAME,
    secret: authOptions.secret,
  })

  const sso = req.body['sso']
  const sig = req.body['sig']

  if (!sso || !sig || !session) {
    res.status(400).send({})
    return
  }

  const signature = crypto
    .createHmac('sha256', process.env.APP_SECRET as string)
    .update(sso)
    .digest('hex')

  // if the signature is invalid, redirect the user to the login page
  if (signature !== sig) {
    res.status(400).send({})
    return
  }

  const bufferObj = Buffer.from(sso, 'base64')

  const ssoURL = new URL('http://anyhost?' + bufferObj.toString('utf8'))

  const nonce = ssoURL.searchParams.get('nonce')
  const redirectURL = ssoURL.searchParams.get('return_sso_url')

  const userEmail = session.email
  const userId = session.sub
  const userShortname = session.shortname
  const userRole = session.role

  let payload = `nonce=${nonce}&email=${encodeURIComponent(
    userEmail
  )}&external_id=${userId}&username=${encodeURIComponent(userShortname)}`

  if (userRole === UserRole.ADMIN) {
    payload += '&admin=true'
  }

  const encodedPayload = Buffer.from(payload, 'utf8').toString('base64')

  const hashedPayload = crypto
    .createHmac('sha256', process.env.APP_SECRET as string)
    .update(encodedPayload)
    .digest('hex')

  res.status(200).json({
    redirectURL: `${redirectURL}?sso=${encodedPayload}&sig=${hashedPayload}`,
  })
}
