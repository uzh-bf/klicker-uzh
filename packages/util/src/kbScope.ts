const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_KB_IDS = 32

function normalizeIds(value: unknown, allowEmpty = false): string[] {
  if (
    !Array.isArray(value) ||
    (!allowEmpty && value.length === 0) ||
    value.length > MAX_KB_IDS
  ) {
    throw new Error('Invalid knowledge-base scope')
  }
  const ids = value.map((id: unknown) => {
    if (typeof id !== 'string' || !UUID_PATTERN.test(id.trim())) {
      throw new Error('Invalid knowledge-base ID')
    }
    return id.trim().toLowerCase()
  })
  if (new Set(ids).size !== ids.length) {
    throw new Error('Duplicate knowledge-base ID')
  }
  return ids.sort()
}

/** Read only explicit grants; extra legacy scope IDs are not shared grants. */
export function readSharedKbIds(parameters: unknown): string[] {
  if (
    !parameters ||
    typeof parameters !== 'object' ||
    Array.isArray(parameters)
  ) {
    return []
  }
  const value = parameters as Record<string, unknown>
  if (!Object.hasOwn(value, 'shared_kb_ids')) return []
  const shared = normalizeIds(value.shared_kb_ids)
  if (Object.hasOwn(value, 'kb_id') === Object.hasOwn(value, 'kb_ids')) {
    throw new Error('Shared grants require one effective knowledge-base scope')
  }
  const effective = normalizeIds(
    Object.hasOwn(value, 'kb_id') ? [value.kb_id] : value.kb_ids
  )
  if (shared.some((id) => !effective.includes(id))) {
    throw new Error('Shared grant is absent from the effective scope')
  }
  return shared
}

/** Every enabled mode of one chatbot must carry the same operator grants. */
export function resolveSharedKbIds(parameters: readonly unknown[]): string[] {
  const scopes = parameters.map(readSharedKbIds)
  const first = scopes[0] ?? []
  if (scopes.some((ids) => JSON.stringify(ids) !== JSON.stringify(first))) {
    throw new Error('Shared knowledge-base grants differ between modes')
  }
  return first
}

export function composeKbScope(
  courseKbIds: readonly string[],
  sharedKbIds: readonly string[]
): {
  kb_id?: string
  kb_ids?: string[]
  shared_kb_ids?: string[]
} {
  const course = normalizeIds(courseKbIds, true)
  const shared = normalizeIds(sharedKbIds, true)
  const ids = normalizeIds([...new Set([...course, ...shared])], true)
  return {
    ...(ids.length === 1
      ? { kb_id: ids[0]! }
      : ids.length > 1
        ? { kb_ids: ids }
        : {}),
    ...(shared.length ? { shared_kb_ids: shared } : {}),
  }
}
