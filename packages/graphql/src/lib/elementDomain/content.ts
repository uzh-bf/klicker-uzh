import { z } from 'zod'
import { parseWithDomainErrors } from './core.js'

const emptyOptionsSchema = z.object({}).strict()

export function normalizeContentOptions(value: unknown) {
  return parseWithDomainErrors(emptyOptionsSchema, value)
}
