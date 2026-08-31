export function createFreeTextSubmissionId() {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('This browser cannot create a secure submission ID')
  }

  return globalThis.crypto.randomUUID()
}
