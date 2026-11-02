export type RootWeightEntry<Key> = {
  key: Key
  weight: number
}

export type RootWeightNormalization<Key> =
  | {
      ok: true
      normalized: ReadonlyArray<RootWeightEntry<Key>>
    }
  | {
      ok: false
      reason: 'NO_ENABLED_ROOTS' | 'INVALID_ENABLED_ROOT_WEIGHT'
      invalidKeys: ReadonlyArray<Key>
    }

export function normalizeEnabledRootWeights<Key>(
  entries: ReadonlyArray<RootWeightEntry<Key>>
): RootWeightNormalization<Key> {
  if (entries.length === 0) {
    return { ok: false, reason: 'NO_ENABLED_ROOTS', invalidKeys: [] }
  }

  const invalidKeys = entries
    .filter(({ weight }) => !Number.isFinite(weight) || weight <= 0)
    .map(({ key }) => key)
  if (invalidKeys.length > 0) {
    return {
      ok: false,
      reason: 'INVALID_ENABLED_ROOT_WEIGHT',
      invalidKeys,
    }
  }

  const maximumWeight = Math.max(...entries.map(({ weight }) => weight))
  const scaled = entries.map(({ key, weight }) => ({
    key,
    weight: weight / maximumWeight,
  }))
  const underflowedKeys = scaled
    .filter(({ weight }) => !Number.isFinite(weight) || weight <= 0)
    .map(({ key }) => key)
  if (underflowedKeys.length > 0) {
    return {
      ok: false,
      reason: 'INVALID_ENABLED_ROOT_WEIGHT',
      invalidKeys: underflowedKeys,
    }
  }

  const scaledTotal = scaled.reduce((sum, { weight }) => sum + weight, 0)
  const normalized = scaled.map(({ key, weight }) => ({
    key,
    weight: weight / scaledTotal,
  }))
  const normalizedUnderflowKeys = normalized
    .filter(({ weight }) => !Number.isFinite(weight) || weight <= 0)
    .map(({ key }) => key)
  if (normalizedUnderflowKeys.length > 0) {
    return {
      ok: false,
      reason: 'INVALID_ENABLED_ROOT_WEIGHT',
      invalidKeys: normalizedUnderflowKeys,
    }
  }

  return {
    ok: true,
    normalized,
  }
}
