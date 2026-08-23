export function normalizeIdentityValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  if (Array.isArray(value) && value.length === 1) {
    return normalizeIdentityValue(value[0])
  }

  return null
}
