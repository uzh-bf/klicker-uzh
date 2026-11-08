import { randomBytes } from 'crypto'

export const QR_SCAN_CODE_LENGTH = 12
export const QR_SCAN_CODE_PATTERN = /^[A-Za-z0-9_-]{12}$/

/** Generate a URL-safe opaque code with 72 bits of CSPRNG entropy. */
export function generateQrScanCode(): string {
  return randomBytes(9).toString('base64url')
}
