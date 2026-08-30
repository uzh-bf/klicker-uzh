import type { ToolSet } from 'ai'
import { describe, expect, test, vi } from 'vitest'
import {
  classifyManageAssistantCapabilityState,
  createManageAssistantPreflightSignal,
  fetchManageAssistantChatWithCapability,
  INITIAL_MANAGE_ASSISTANT_CAPABILITY_STATE,
  isManageAssistantCapabilityState,
  MANAGE_ASSISTANT_CAPABILITY_HEADER,
  reduceManageAssistantCapabilityState,
  selectManageAssistantTools,
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

  test('exposes only tools permitted by the advertised capability', () => {
    const readTool = 'klicker_lecturer_element_search'
    const proposalTool = 'klicker_lecturer_element_create_draft_proposal'
    const scaffoldTool = 'klicker_lecturer_question_draft'
    const inventory = tools(
      'klicker_lecturer_capabilities',
      readTool,
      scaffoldTool,
      proposalTool,
      'klicker_lecturer_future_write'
    )

    expect(
      Object.keys(selectManageAssistantTools(inventory, 'unavailable'))
    ).toEqual([])
    expect(
      Object.keys(selectManageAssistantTools(inventory, 'read-only'))
    ).toEqual([readTool])
    expect(
      Object.keys(selectManageAssistantTools(inventory, 'draft-and-read'))
    ).toEqual([readTool, scaffoldTool, proposalTool])
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

  test('rejects an impossible capability state action at runtime', () => {
    expect(() =>
      reduceManageAssistantCapabilityState(
        INITIAL_MANAGE_ASSISTANT_CAPABILITY_STATE,
        { type: 'unexpected' } as never
      )
    ).toThrow('Unknown Manage assistant capability action')
  })

  test('bounds a browser preflight independently of the server request', async () => {
    const controller = new AbortController()
    const signal = createManageAssistantPreflightSignal(controller.signal, 1)

    expect(signal.aborted).toBe(false)
    await new Promise<void>((resolve) => {
      if (signal.aborted) return resolve()
      signal.addEventListener('abort', () => resolve(), { once: true })
    })
    expect(signal.aborted).toBe(true)
    expect(controller.signal.aborted).toBe(false)
  })

  test('lets only the latest-started chat response update capability state', async () => {
    let resolveOlder!: (response: Response) => void
    let resolveNewer!: (response: Response) => void
    const olderResponse = new Promise<Response>((resolve) => {
      resolveOlder = resolve
    })
    const newerResponse = new Promise<Response>((resolve) => {
      resolveNewer = resolve
    })
    const fetchImplementation = vi
      .fn()
      .mockReturnValueOnce(olderResponse)
      .mockReturnValueOnce(newerResponse) as typeof globalThis.fetch
    const turnRevision = { current: 0 }
    const resolvedCapabilities: string[] = []

    const olderRequest = fetchManageAssistantChatWithCapability(
      fetchImplementation,
      '/api/manage/chat',
      undefined,
      turnRevision,
      (capability) => resolvedCapabilities.push(capability)
    )
    expect(turnRevision.current).toBe(1)
    const newerRequest = fetchManageAssistantChatWithCapability(
      fetchImplementation,
      '/api/manage/chat',
      undefined,
      turnRevision,
      (capability) => resolvedCapabilities.push(capability)
    )
    expect(turnRevision.current).toBe(2)

    resolveNewer(
      new Response(null, {
        headers: {
          [MANAGE_ASSISTANT_CAPABILITY_HEADER]: 'draft-and-read',
        },
      })
    )
    await newerRequest
    resolveOlder(
      new Response(null, {
        headers: {
          [MANAGE_ASSISTANT_CAPABILITY_HEADER]: 'unavailable',
        },
      })
    )
    await olderRequest

    expect(resolvedCapabilities).toEqual(['draft-and-read'])
  })
})
