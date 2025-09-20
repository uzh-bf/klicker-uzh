import * as crypto from 'crypto'

const algorithm = 'aes-256-gcm'

function getEncryptionKey(): Buffer {
  const appSecret = process.env.APP_SECRET
  if (!appSecret) {
    throw new Error(
      'APP_SECRET environment variable is required for encryption'
    )
  }
  return crypto.createHash('sha256').update(appSecret).digest()
}

/**
 * Encrypts a string using AES-256-GCM with the APP_SECRET
 * @param text - The plaintext to encrypt
 * @returns Encrypted string in format "iv:authTag:encryptedData"
 */
export function encrypt(text: string): string {
  if (!text || text.trim() === '') {
    throw new Error('Cannot encrypt empty or null text')
  }

  const key = getEncryptionKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(algorithm, key, iv) as crypto.CipherGCM

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // Format: iv:authTag:encryptedData
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Decrypts a string that was encrypted with the encrypt function
 * @param encryptedData - The encrypted string in format "iv:authTag:encryptedData"
 * @returns The decrypted plaintext
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData || !isEncrypted(encryptedData)) {
    throw new Error('Invalid encrypted data format')
  }

  const key = getEncryptionKey()
  const parts = encryptedData.split(':')

  if (parts.length !== 3) {
    throw new Error(
      'Invalid encrypted data format - expected 3 parts separated by colons'
    )
  }

  const [ivHex, authTagHex, encrypted] = parts

  const iv = Buffer.from(ivHex!, 'hex')
  const authTag = Buffer.from(authTagHex!, 'hex')

  const decipher = crypto.createDecipheriv(
    algorithm,
    key,
    iv
  ) as crypto.DecipherGCM
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted!, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Checks if a value appears to be encrypted by this module
 * @param value - The value to check
 * @returns True if the value looks like encrypted data
 */
export function isEncrypted(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false
  }

  // Check if it has the expected format: hex:hex:hex
  const parts = value.split(':')
  if (parts.length !== 3) {
    return false
  }

  // Check if all parts are valid hex strings
  const hexRegex = /^[0-9a-f]+$/i
  return parts.every((part) => part.length > 0 && hexRegex.test(part))
}

/**
 * Safely encrypts a value only if it's not already encrypted
 * @param value - The value to encrypt
 * @returns Encrypted value or the original value if already encrypted
 */
export function safeEncrypt(value: string): string {
  if (!value) {
    return value
  }

  if (isEncrypted(value)) {
    return value
  }

  return encrypt(value)
}

/**
 * Safely decrypts a value only if it appears to be encrypted
 * @param value - The value to decrypt
 * @returns Decrypted value or the original value if not encrypted
 */
export function safeDecrypt(value: string): string {
  if (!value) {
    return value
  }

  if (!isEncrypted(value)) {
    return value
  }

  return decrypt(value)
}
