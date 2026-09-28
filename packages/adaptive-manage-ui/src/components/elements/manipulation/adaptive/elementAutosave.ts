import type { ElementFormTypes } from '../../../../types/elementForm'
import type { PendingAdaptiveMappingDraft } from './types'

export const ELEMENT_AUTOSAVE_VERSION = 4 as const

export interface ElementAutosavePayload {
  version: typeof ELEMENT_AUTOSAVE_VERSION
  creationRequestId: string
  formValues: ElementFormTypes
  pendingMapping: PendingAdaptiveMappingDraft[] | null
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFormValues(value: unknown): value is ElementFormTypes {
  return (
    isRecord(value) &&
    typeof value.type === 'string' &&
    typeof value.name === 'string' &&
    typeof value.status === 'string' &&
    typeof value.content === 'string' &&
    typeof value.basePoints === 'boolean' &&
    typeof value.pointsMultiplier === 'string'
  )
}

function isPendingMapping(
  value: unknown
): value is PendingAdaptiveMappingDraft {
  if (!isRecord(value) || typeof value.treeId !== 'string') return false

  const assignment = value.assignment
  return (
    isRecord(assignment) &&
    (assignment.leafNodeId === null ||
      Number.isInteger(assignment.leafNodeId)) &&
    (typeof assignment.additionalLeafNodeIds === 'undefined' ||
      (Array.isArray(assignment.additionalLeafNodeIds) &&
        assignment.additionalLeafNodeIds.every(Number.isInteger))) &&
    (assignment.levelId === null || Number.isInteger(assignment.levelId)) &&
    typeof assignment.enabled === 'boolean' &&
    typeof assignment.enablePercentInput === 'boolean' &&
    (typeof assignment.discrimination === 'undefined' ||
      assignment.discrimination === null ||
      typeof assignment.discrimination === 'number')
  )
}

function normalizePendingMapping(
  mapping: PendingAdaptiveMappingDraft
): PendingAdaptiveMappingDraft {
  return {
    ...mapping,
    assignment: {
      ...mapping.assignment,
      additionalLeafNodeIds: mapping.assignment.additionalLeafNodeIds ?? [],
    },
  }
}

export function isElementAutosavePayload(
  value: unknown
): value is ElementAutosavePayload {
  return (
    isRecord(value) &&
    value.version === ELEMENT_AUTOSAVE_VERSION &&
    typeof value.creationRequestId === 'string' &&
    UUID_PATTERN.test(value.creationRequestId) &&
    isFormValues(value.formValues) &&
    (value.pendingMapping === null ||
      (Array.isArray(value.pendingMapping) &&
        value.pendingMapping.every(isPendingMapping)))
  )
}

export function createElementAutosavePayload(
  formValues: ElementFormTypes,
  pendingMapping: PendingAdaptiveMappingDraft[] | null = null,
  creationRequestId = globalThis.crypto.randomUUID()
): ElementAutosavePayload {
  return {
    version: ELEMENT_AUTOSAVE_VERSION,
    creationRequestId,
    formValues,
    pendingMapping,
  }
}

export function restoreElementAutosave(
  storedValue: unknown
): ElementAutosavePayload | null {
  if (isElementAutosavePayload(storedValue)) {
    return {
      ...storedValue,
      pendingMapping:
        storedValue.pendingMapping?.map(normalizePendingMapping) ?? null,
    }
  }
  if (isFormValues(storedValue))
    return createElementAutosavePayload(storedValue)

  if (
    isRecord(storedValue) &&
    (storedValue.version === 2 || storedValue.version === 3) &&
    isFormValues(storedValue.formValues)
  ) {
    const pendingMapping = storedValue.pendingMapping
    if (pendingMapping === null || isPendingMapping(pendingMapping)) {
      return createElementAutosavePayload(
        storedValue.formValues,
        pendingMapping ? [normalizePendingMapping(pendingMapping)] : null,
        typeof storedValue.creationRequestId === 'string' &&
          UUID_PATTERN.test(storedValue.creationRequestId)
          ? storedValue.creationRequestId
          : undefined
      )
    }
  }

  // Migrate in-progress v1 drafts. Completed element/mapping recovery states are
  // intentionally not revived because creation and assignment are now atomic.
  if (
    isRecord(storedValue) &&
    storedValue.version === 1 &&
    isFormValues(storedValue.formValues) &&
    isRecord(storedValue.mappingRecovery) &&
    storedValue.mappingRecovery.phase === 'editing'
  ) {
    const pendingMapping = storedValue.mappingRecovery.pendingMapping
    if (pendingMapping === null || isPendingMapping(pendingMapping)) {
      return createElementAutosavePayload(
        storedValue.formValues,
        pendingMapping ? [normalizePendingMapping(pendingMapping)] : null,
        typeof storedValue.creationRequestId === 'string' &&
          UUID_PATTERN.test(storedValue.creationRequestId)
          ? storedValue.creationRequestId
          : undefined
      )
    }
  }

  return null
}

export function restoreElementAutosaveStorageValue(
  storedValue: string | null
): ElementAutosavePayload | null {
  if (storedValue === null) return null
  try {
    return restoreElementAutosave(JSON.parse(storedValue) as unknown)
  } catch {
    return null
  }
}

export function updateElementAutosaveFormValues(
  payload: ElementAutosavePayload,
  formValues: ElementFormTypes
): ElementAutosavePayload {
  return { ...payload, formValues }
}

export function updatePendingMapping(
  payload: ElementAutosavePayload,
  pendingMapping: PendingAdaptiveMappingDraft[] | null
): ElementAutosavePayload {
  return { ...payload, pendingMapping }
}
