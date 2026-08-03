import type { ElementFormTypes } from '../types'
import type { PendingAdaptiveMapping } from './types'

export const ELEMENT_AUTOSAVE_VERSION = 3 as const

export interface ElementAutosavePayload {
  version: typeof ELEMENT_AUTOSAVE_VERSION
  creationRequestId: string
  formValues: ElementFormTypes
  pendingMapping: PendingAdaptiveMapping | null
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

function isPendingMapping(value: unknown): value is PendingAdaptiveMapping {
  if (!isRecord(value) || typeof value.treeId !== 'string') return false

  const assignment = value.assignment
  return (
    isRecord(assignment) &&
    Number.isInteger(assignment.leafNodeId) &&
    Number.isInteger(assignment.levelId) &&
    typeof assignment.enabled === 'boolean' &&
    typeof assignment.enablePercentInput === 'boolean' &&
    (typeof assignment.discrimination === 'undefined' ||
      assignment.discrimination === null ||
      typeof assignment.discrimination === 'number')
  )
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
    (value.pendingMapping === null || isPendingMapping(value.pendingMapping))
  )
}

export function createElementAutosavePayload(
  formValues: ElementFormTypes,
  pendingMapping: PendingAdaptiveMapping | null = null,
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
  if (isElementAutosavePayload(storedValue)) return storedValue
  if (isFormValues(storedValue))
    return createElementAutosavePayload(storedValue)

  if (
    isRecord(storedValue) &&
    storedValue.version === 2 &&
    isFormValues(storedValue.formValues)
  ) {
    const pendingMapping = storedValue.pendingMapping
    if (pendingMapping === null || isPendingMapping(pendingMapping)) {
      return createElementAutosavePayload(
        storedValue.formValues,
        pendingMapping
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
        pendingMapping
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
  pendingMapping: PendingAdaptiveMapping | null
): ElementAutosavePayload {
  return { ...payload, pendingMapping }
}
