import {
  ElementDisplayMode,
  ElementStatus,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { describe, expect, it } from 'vitest'
import type { ElementFormTypes } from '../types'
import {
  ELEMENT_AUTOSAVE_VERSION,
  createElementAutosavePayload,
  restoreElementAutosave,
  restoreElementAutosaveStorageValue,
  updateElementAutosaveFormValues,
  updatePendingMapping,
} from './elementAutosave'
import type { PendingAdaptiveMapping } from './types'

const formValues: ElementFormTypes = {
  type: ElementType.Sc,
  name: 'Autosaved question',
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
    discrimination: null,
  },
}
const creationRequestId = '10000000-0000-4000-8000-000000000001'

describe('element autosave', () => {
  it('stores form values and the pending first-save assignment', () => {
    const payload = updatePendingMapping(
      createElementAutosavePayload(formValues, null, creationRequestId),
      pendingMapping
    )
    const renamedValues = { ...formValues, name: 'Renamed question' }

    expect(updateElementAutosaveFormValues(payload, renamedValues)).toEqual({
      version: ELEMENT_AUTOSAVE_VERSION,
      creationRequestId,
      formValues: renamedValues,
      pendingMapping,
    })
  })

  it('restores serialized v3 and migrates v2 and legacy drafts', () => {
    const payload = createElementAutosavePayload(
      formValues,
      pendingMapping,
      creationRequestId
    )

    expect(restoreElementAutosave(JSON.parse(JSON.stringify(payload)))).toEqual(
      payload
    )
    expect(restoreElementAutosave(formValues)).toMatchObject({
      version: ELEMENT_AUTOSAVE_VERSION,
      formValues,
      pendingMapping: null,
      creationRequestId: expect.any(String),
    })
    expect(
      restoreElementAutosave({
        version: 2,
        formValues,
        pendingMapping,
      })
    ).toMatchObject({
      version: ELEMENT_AUTOSAVE_VERSION,
      formValues,
      pendingMapping,
      creationRequestId: expect.any(String),
    })
  })

  it('preserves one creation request across autosave updates', () => {
    const payload = createElementAutosavePayload(
      formValues,
      pendingMapping,
      creationRequestId
    )
    expect(
      updateElementAutosaveFormValues(payload, {
        ...formValues,
        name: 'Changed',
      }).creationRequestId
    ).toBe(creationRequestId)
    expect(updatePendingMapping(payload, null).creationRequestId).toBe(
      creationRequestId
    )
  })

  it('migrates editable v1 drafts but drops obsolete recovery states', () => {
    expect(
      restoreElementAutosave({
        version: 1,
        formValues,
        mappingRecovery: { phase: 'editing', pendingMapping },
      })
    ).toMatchObject({
      version: ELEMENT_AUTOSAVE_VERSION,
      formValues,
      pendingMapping,
      creationRequestId: expect.any(String),
    })
    expect(
      restoreElementAutosave({
        version: 1,
        formValues,
        mappingRecovery: {
          phase: 'mapping-failed',
          elementId: 42,
          pendingMapping,
        },
      })
    ).toBeNull()
  })

  it('rejects invalid local-storage values', () => {
    expect(restoreElementAutosaveStorageValue('{invalid')).toBeNull()
    expect(restoreElementAutosaveStorageValue(null)).toBeNull()
  })
})
