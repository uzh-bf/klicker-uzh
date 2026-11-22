import { ElementOptionsInput } from '@klicker-uzh/types'
import validateSharedChoicesFields from './validateSharedChoicesFields.js'

function validateKPRIMOptions(options?: ElementOptionsInput | null) {
  let valid = validateSharedChoicesFields(options)
  if (!valid) return false

  // KPRIM only: exactly four choice options are required
  if (options!.choices!.length !== 4) {
    return false
  }

  return true
}

export default validateKPRIMOptions
