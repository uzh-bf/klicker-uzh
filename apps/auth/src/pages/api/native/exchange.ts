import type { NextApiRequest, NextApiResponse } from 'next'
import { nativeEndpoint } from '@/lib/nativeHandoff'

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } }

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return nativeEndpoint(req, res, 'exchange')
}
