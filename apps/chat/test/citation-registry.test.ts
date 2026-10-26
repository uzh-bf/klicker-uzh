import { describe, expect, test } from 'vitest'

import {
  type CitationRegistryState,
  citationRegistryReducer,
  partitionSources,
} from '../src/components/message-sources-context'
import type { ChatSource } from '../src/lib/sources/types'

const SOURCE_1: ChatSource = {
  id: 'source-1',
  index: 1,
  type: 'document',
  title: 'First source',
}
const SOURCE_2: ChatSource = {
  id: 'source-2',
  index: 2,
  type: 'document',
  title: 'Second source',
}
const SOURCE_3: ChatSource = {
  id: 'source-3',
  index: 3,
  type: 'document',
  title: 'Third source',
}

function initialState(
  messageId = 'message-1',
  sources: ChatSource[] = [SOURCE_1, SOURCE_2, SOURCE_3]
): CitationRegistryState {
  return {
    messageId,
    sourceList: sources,
    counts: new Map(),
    ready: false,
  }
}

describe('citation registry', () => {
  test('keeps duplicate registrations counted until every duplicate cleans up', () => {
    const ready = citationRegistryReducer(initialState(), {
      type: 'ready',
      messageId: 'message-1',
      sourceList: [SOURCE_1, SOURCE_2, SOURCE_3],
    })
    const once = citationRegistryReducer(ready, {
      type: 'register',
      messageId: 'message-1',
      index: 1,
    })
    const twice = citationRegistryReducer(once, {
      type: 'register',
      messageId: 'message-1',
      index: 1,
    })
    const afterOneCleanup = citationRegistryReducer(twice, {
      type: 'unregister',
      messageId: 'message-1',
      index: 1,
    })

    expect(afterOneCleanup.counts.get(1)).toBe(1)
    expect(
      citationRegistryReducer(afterOneCleanup, {
        type: 'unregister',
        messageId: 'message-1',
        index: 1,
      }).counts.has(1)
    ).toBe(false)
  })

  test('ignores cleanup from a replaced message and resets counts on message identity', () => {
    const oldMessage = citationRegistryReducer(initialState(), {
      type: 'register',
      messageId: 'message-1',
      index: 1,
    })
    const newMessage = citationRegistryReducer(oldMessage, {
      type: 'ready',
      messageId: 'message-2',
      sourceList: [SOURCE_1, SOURCE_2],
    })
    const afterStaleCleanup = citationRegistryReducer(newMessage, {
      type: 'unregister',
      messageId: 'message-1',
      index: 1,
    })

    expect(afterStaleCleanup).toMatchObject({
      messageId: 'message-2',
      ready: true,
    })
    expect(afterStaleCleanup.counts.size).toBe(0)
  })

  test('preserves normalized numbering and partitions cited sources in source order', () => {
    const { citedSources, uncitedSources } = partitionSources(
      [SOURCE_1, SOURCE_2, SOURCE_3],
      new Map([
        [3, 1],
        [1, 2],
      ])
    )

    expect(citedSources.map((source) => source.index)).toEqual([1, 3])
    expect(uncitedSources.map((source) => source.index)).toEqual([2])
  })

  test('an empty registry leaves every normalized source in the collapsed partition', () => {
    const { citedSources, uncitedSources } = partitionSources(
      [SOURCE_1, SOURCE_2],
      new Map()
    )

    expect(citedSources).toEqual([])
    expect(uncitedSources).toEqual([SOURCE_1, SOURCE_2])
  })
})
