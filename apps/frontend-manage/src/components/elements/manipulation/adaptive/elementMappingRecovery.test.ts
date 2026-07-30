import {
  ElementDisplayMode,
  ElementStatus,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { describe, expect, it } from 'vitest'
import type { ElementFormTypes } from '../types'
import {
  ELEMENT_AUTOSAVE_VERSION,
  completeElementAutosave,
  createElementAutosavePayload,
  getRecoveredElementId,
  markElementSavedForMapping,
  markMappingFailed,
  markMappingRetry,
  restoreElementAutosave,
  restoreElementAutosaveStorageValue,
  shouldPersistElement,
  updateElementAutosaveFormValues,
  updatePendingMapping,
} from './elementMappingRecovery'
import type { PendingAdaptiveMapping } from './types'

const formValues: ElementFormTypes = {
  type: ElementType.Sc,
  name: 'Recovery question',
  status: ElementStatus.Ready,
  content: 'Question content',
  explanation: null,
  basePoints: true,
  pointsMultiplier: '1',
  tags: [],
  options: {
    choices: [
      { id: 'choice-1', value: 'Correct', correct: true },
      { id: 'choice-2', value: 'Incorrect', correct: false },
    ],
    displayMode: ElementDisplayMode.List,
    hasAnswerFeedbacks: false,
    hasSampleSolution: true,
  },
}

const pendingMapping: PendingAdaptiveMapping = {
  treeId: 'tree-1',
  assignment: {
    leafNodeId: 11,
    levelId: 22,
    enabled: true,
    enablePercentInput: false,
    discrimination: 1.25,
  },
}

function mappingPendingPayload() {
  return markElementSavedForMapping(
    createElementAutosavePayload(formValues, pendingMapping),
    42
  )
}

describe('element mapping autosave recovery', () => {
  it('migrates legacy form-only autosaves to the versioned payload', () => {
    const restored = restoreElementAutosave(formValues)

    expect(restored).toEqual({
      version: ELEMENT_AUTOSAVE_VERSION,
      formValues,
      mappingRecovery: { phase: 'editing', pendingMapping: null },
    })
    expect(restored?.formValues).toBe(formValues)
  })

  it('restores a durable failed mapping payload after serialization', () => {
    const failed = markMappingFailed(mappingPendingPayload())
    const serialized = JSON.parse(JSON.stringify(failed)) as unknown

    expect(restoreElementAutosave(serialized)).toEqual(failed)
    expect(restoreElementAutosave({ ...failed, version: 2 })).toBeNull()
  })

  it('recognizes durable recovery state from local storage', () => {
    const failed = markMappingFailed(mappingPendingPayload())

    expect(restoreElementAutosaveStorageValue(JSON.stringify(failed))).toEqual(
      failed
    )
    expect(restoreElementAutosaveStorageValue('{invalid')).toBeNull()
    expect(restoreElementAutosaveStorageValue(null)).toBeNull()
  })

  it('preserves form values and pending mapping while editing', () => {
    const renamedValues = { ...formValues, name: 'Renamed question' }
    const withMapping = updatePendingMapping(
      createElementAutosavePayload(formValues),
      pendingMapping
    )
    const updated = updateElementAutosaveFormValues(withMapping, renamedValues)

    expect(updated.formValues).toBe(renamedValues)
    expect(updated.mappingRecovery).toEqual({
      phase: 'editing',
      pendingMapping,
    })
  })

  it('moves failure, retry, and abandonment through idempotent transitions', () => {
    const pending = mappingPendingPayload()
    const failed = markMappingFailed(pending)
    const retried = markMappingRetry(failed)

    expect(failed.mappingRecovery).toEqual({
      phase: 'mapping-failed',
      elementId: 42,
      pendingMapping,
    })
    expect(markMappingFailed(failed)).toBe(failed)
    expect(retried.mappingRecovery).toEqual({
      phase: 'mapping-pending',
      elementId: 42,
      pendingMapping,
    })
    expect(markMappingRetry(retried)).toBe(retried)
    expect(completeElementAutosave(failed, 'mapping-abandoned')).toBeNull()
    expect(completeElementAutosave(retried, 'mapping-confirmed')).toBeNull()
  })

  it('clears an element-only autosave but retains an unchosen mapping', () => {
    const elementOnly = createElementAutosavePayload(formValues)
    const mappingDraft = updatePendingMapping(elementOnly, pendingMapping)

    expect(completeElementAutosave(elementOnly, 'element-saved')).toBeNull()
    expect(completeElementAutosave(mappingDraft, 'element-saved')).toBe(
      mappingDraft
    )
    expect(completeElementAutosave(mappingDraft, 'mapping-abandoned')).toBe(
      mappingDraft
    )
  })

  it('prevents duplicate element persistence after an id was retained', () => {
    const editing = createElementAutosavePayload(formValues, pendingMapping)
    const pending = markElementSavedForMapping(editing, 42)
    const failed = markMappingFailed(pending)

    expect(shouldPersistElement(editing)).toBe(true)
    expect(shouldPersistElement(pending)).toBe(false)
    expect(shouldPersistElement(failed)).toBe(false)
    expect(getRecoveredElementId(failed)).toBe(42)
    expect(markElementSavedForMapping(pending, 99)).toBe(pending)
  })
})
