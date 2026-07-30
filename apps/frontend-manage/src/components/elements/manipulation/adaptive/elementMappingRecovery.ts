import type { ElementFormTypes } from '../types'
import type { PendingAdaptiveMapping } from './types'

export const ELEMENT_AUTOSAVE_VERSION = 1 as const

export type ElementMappingRecovery =
  | {
      phase: 'editing'
      pendingMapping: PendingAdaptiveMapping | null
    }
  | {
      phase: 'mapping-pending' | 'mapping-failed'
      elementId: number
      pendingMapping: PendingAdaptiveMapping
    }

export interface ElementAutosavePayload {
  version: typeof ELEMENT_AUTOSAVE_VERSION
  formValues: ElementFormTypes
  mappingRecovery: ElementMappingRecovery
}

export type ElementAutosaveCompletion =
  | 'element-saved'
  | 'mapping-confirmed'
  | 'mapping-abandoned'

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
  if (!isRecord(value) || typeof value.treeId !== 'string') {
    return false
  }

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

function isMappingRecovery(value: unknown): value is ElementMappingRecovery {
  if (!isRecord(value) || typeof value.phase !== 'string') {
    return false
  }

  if (value.phase === 'editing') {
    return (
      value.pendingMapping === null || isPendingMapping(value.pendingMapping)
    )
  }

  return (
    (value.phase === 'mapping-pending' || value.phase === 'mapping-failed') &&
    Number.isInteger(value.elementId) &&
    (value.elementId as number) > 0 &&
    isPendingMapping(value.pendingMapping)
  )
}

export function isElementAutosavePayload(
  value: unknown
): value is ElementAutosavePayload {
  return (
    isRecord(value) &&
    value.version === ELEMENT_AUTOSAVE_VERSION &&
    isFormValues(value.formValues) &&
    isMappingRecovery(value.mappingRecovery)
  )
}

export function createElementAutosavePayload(
  formValues: ElementFormTypes,
  pendingMapping: PendingAdaptiveMapping | null = null
): ElementAutosavePayload {
  return {
    version: ELEMENT_AUTOSAVE_VERSION,
    formValues,
    mappingRecovery: {
      phase: 'editing',
      pendingMapping,
    },
  }
}

export function restoreElementAutosave(
  storedValue: unknown
): ElementAutosavePayload | null {
  if (isElementAutosavePayload(storedValue)) {
    return storedValue
  }

  if (isFormValues(storedValue)) {
    return createElementAutosavePayload(storedValue)
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
  if (payload.mappingRecovery.phase !== 'editing') {
    return payload
  }

  return {
    ...payload,
    mappingRecovery: { phase: 'editing', pendingMapping },
  }
}

export function markElementSavedForMapping(
  payload: ElementAutosavePayload,
  elementId: number
): ElementAutosavePayload {
  if (
    payload.mappingRecovery.phase !== 'editing' ||
    !payload.mappingRecovery.pendingMapping ||
    !Number.isInteger(elementId) ||
    elementId <= 0
  ) {
    return payload
  }

  return {
    ...payload,
    mappingRecovery: {
      phase: 'mapping-pending',
      elementId,
      pendingMapping: payload.mappingRecovery.pendingMapping,
    },
  }
}

export function markMappingFailed(
  payload: ElementAutosavePayload
): ElementAutosavePayload {
  if (payload.mappingRecovery.phase !== 'mapping-pending') {
    return payload
  }

  return {
    ...payload,
    mappingRecovery: {
      ...payload.mappingRecovery,
      phase: 'mapping-failed',
    },
  }
}

export function markMappingRetry(
  payload: ElementAutosavePayload
): ElementAutosavePayload {
  if (payload.mappingRecovery.phase !== 'mapping-failed') {
    return payload
  }

  return {
    ...payload,
    mappingRecovery: {
      ...payload.mappingRecovery,
      phase: 'mapping-pending',
    },
  }
}

export function shouldPersistElement(payload: ElementAutosavePayload): boolean {
  return payload.mappingRecovery.phase === 'editing'
}

export function getRecoveredElementId(
  payload: ElementAutosavePayload
): number | undefined {
  return payload.mappingRecovery.phase === 'editing'
    ? undefined
    : payload.mappingRecovery.elementId
}

export function completeElementAutosave(
  payload: ElementAutosavePayload,
  completion: ElementAutosaveCompletion
): ElementAutosavePayload | null {
  const recovery = payload.mappingRecovery

  if (completion === 'element-saved') {
    return recovery.phase === 'editing' && recovery.pendingMapping === null
      ? null
      : payload
  }

  return recovery.phase === 'editing' ? payload : null
}
