import { randomBytes } from 'crypto'

export {
  gradeQrScanResponse,
  isValidQrScanCode,
  normalizeQrScanCode,
  QR_SCAN_CODE_LENGTH,
  QR_SCAN_CODE_PATTERN,
} from '@klicker-uzh/types'

/** Generate a URL-safe opaque code with 72 bits of CSPRNG entropy. */
export function generateQrScanCode(): string {
  return randomBytes(9).toString('base64url')
}
