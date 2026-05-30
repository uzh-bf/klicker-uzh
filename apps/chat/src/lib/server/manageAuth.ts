import { verifyJWT } from '@klicker-uzh/util'
import { cookies } from 'next/headers'

export async function getAuthenticatedManageUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('next-auth.session-token')?.value
  if (!token || !process.env.APP_SECRET) return null

  try {
    const payload = await verifyJWT(token, process.env.APP_SECRET)
    return typeof payload.sub === 'string' && payload.sub ? payload.sub : null
  } catch {
    return null
  }
}
