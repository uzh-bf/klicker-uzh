import type { ToolSet } from 'ai'
import { describe, expect, test } from 'vitest'
import {
  classifyManageAssistantCapabilityState,
  INITIAL_MANAGE_ASSISTANT_CAPABILITY_STATE,
  isManageAssistantCapabilityState,
  reduceManageAssistantCapabilityState,
} from '@/src/services/manageAssistantCapabilities'

function tools(...names: string[]): ToolSet {
  return Object.fromEntries(names.map((name) => [name, {}])) as ToolSet
}

describe('Manage assistant capability state', () => {
  test('classifies the actual session-filtered inventory', () => {
    const readTool = 'klicker_lecturer_element_search'
    const proposalTool = 'klicker_lecturer_element_create_draft_proposal'

    expect(classifyManageAssistantCapabilityState(tools())).toBe('unavailable')
    expect(
      classifyManageAssistantCapabilityState(
        tools('klicker_lecturer_capabilities')
      )
    ).toBe('unavailable')
    expect(classifyManageAssistantCapabilityState(tools(proposalTool))).toBe(
      'unavailable'
    )
    expect(classifyManageAssistantCapabilityState(tools(readTool))).toBe(
      'read-only'
    )
    expect(
      classifyManageAssistantCapabilityState(tools(readTool, proposalTool))
    ).toBe('draft-and-read')
  })

  test('accepts only the three public response states', () => {
    expect(isManageAssistantCapabilityState('draft-and-read')).toBe(true)
    expect(isManageAssistantCapabilityState('read-only')).toBe(true)
    expect(isManageAssistantCapabilityState('unavailable')).toBe(true)
    expect(isManageAssistantCapabilityState('manage:draft')).toBe(false)
    expect(isManageAssistantCapabilityState({ tools: [] })).toBe(false)
  })

  test('starts and retries conservatively before accepting a result', () => {
    const healthy = reduceManageAssistantCapabilityState(
      INITIAL_MANAGE_ASSISTANT_CAPABILITY_STATE,
      { capability: 'draft-and-read', type: 'resolve' }
    )
    expect(healthy).toEqual({
      capability: 'draft-and-read',
      phase: 'settled',
    })

    expect(
      reduceManageAssistantCapabilityState(healthy, { type: 'check' })
    ).toEqual(INITIAL_MANAGE_ASSISTANT_CAPABILITY_STATE)
  })
})
