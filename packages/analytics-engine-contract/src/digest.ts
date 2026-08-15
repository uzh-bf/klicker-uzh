import { createHash } from 'node:crypto'

import { canonicalContract } from './schemas.js'

export const canonicalContractDigest = createHash('sha256')
  .update(JSON.stringify(canonicalContract))
  .digest('hex')
