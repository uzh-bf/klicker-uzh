import { describe, expect, it } from 'vitest'
import { buildLiveQuizSelectionResponseMetadata } from '../src/services/liveQuizResponseCacheMetadata.js'

describe('live quiz response cache metadata', () => {
  it('keeps all selectable IDs separate from correct solution IDs', () => {
    expect(
      buildLiveQuizSelectionResponseMetadata({
        answerCollectionEntries: [{ id: 11 }, { id: 12 }, { id: 13 }],
        solutionIds: [11],
      })
    ).toEqual({
      selectionAnswerIds: '[11,12,13]',
      solutions: '[11]',
    })
  })
})
