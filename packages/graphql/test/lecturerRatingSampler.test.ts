import { describe, expect, it } from 'vitest'
import { selectLecturerRatingFamilies } from '../src/services/lecturerRatingSampler.js'

type Candidate = {
  id: number
  format: 'SC' | 'KPRIM'
  version: number
  originalId?: string | null
  stem: string
  choices: { text: string; correct: boolean }[]
  tags: string[]
}

function candidate(overrides: Partial<Candidate> & Pick<Candidate, 'id'>) {
  return {
    format: 'SC' as const,
    version: 1,
    originalId: null,
    stem: `Synthetic question ${overrides.id}`,
    choices: [
      { text: `Correct answer ${overrides.id}`, correct: true },
      { text: `Distractor ${overrides.id}`, correct: false },
    ],
    tags: [],
    ...overrides,
  }
}

describe('selectLecturerRatingFamilies', () => {
  it('groups true lineage and keeps the newest revision as representative', () => {
    const selected = selectLecturerRatingFamilies([
      candidate({
        id: 1,
        version: 1,
        stem: 'Earlier wording',
      }),
      candidate({
        id: 2,
        version: 3,
        originalId: '1',
        stem: 'Current wording',
      }),
    ])

    expect(selected.map((item) => item.id)).toEqual([2])
  })

  it('groups normalized duplicates with reordered options', () => {
    const selected = selectLecturerRatingFamilies([
      candidate({
        id: 1,
        stem: 'Which option is correct?',
        choices: [
          { text: 'Correct proposition', correct: true },
          { text: 'Incorrect proposition', correct: false },
        ],
      }),
      candidate({
        id: 2,
        stem: '  WHICH option is correct  ',
        choices: [
          { text: 'Incorrect proposition', correct: false },
          { text: 'Correct proposition', correct: true },
        ],
      }),
    ])

    expect(selected.map((item) => item.id)).toEqual([1])
  })

  it('keeps materially different answer keys separate', () => {
    const choices = [
      { text: 'Statement A', correct: true },
      { text: 'Statement B', correct: false },
    ]

    const selected = selectLecturerRatingFamilies([
      candidate({ id: 1, stem: 'Same stem', choices }),
      candidate({
        id: 2,
        stem: 'Same stem',
        choices: [
          { text: 'Statement A', correct: false },
          { text: 'Statement B', correct: true },
        ],
      }),
    ])

    expect(selected.map((item) => item.id).sort()).toEqual([1, 2])
  })

  it('keeps mathematical opposites distinct and merges transitive copies', () => {
    const opts = [
      { text: 'Yes', correct: true },
      { text: 'No', correct: false },
    ]
    const items = [
      candidate({ id: 1, stem: 'Does x < y hold?', choices: opts }),
      candidate({ id: 2, stem: 'Does x > y hold?', choices: opts }),
      candidate({
        id: 3,
        stem: 'An earlier term',
        originalId: '1',
        version: 2,
      }),
      candidate({
        id: 4,
        stem: 'Another wording',
        originalId: '3',
        version: 3,
      }),
    ]
    expect(
      selectLecturerRatingFamilies(items.reverse())
        .map((i) => i.id)
        .sort()
    ).toEqual([2, 4])
  })

  it('is stable when the input order changes', () => {
    const candidates = Array.from({ length: 24 }, (_, index) =>
      candidate({
        id: index + 1,
        format: index % 2 === 0 ? 'SC' : 'KPRIM',
        stem: `Topic ${index + 1} asks about concept ${index + 1}`,
        tags: [`tag-${index % 5}`],
      })
    )

    const forward = selectLecturerRatingFamilies(candidates)
    const reversed = selectLecturerRatingFamilies([...candidates].reverse())

    expect(forward.map((item) => item.id)).toEqual(
      reversed.map((item) => item.id)
    )
  })

  it('prioritizes tag coverage and different wording', () => {
    const candidates = [
      candidate({
        id: 1,
        stem: 'Shared alpha wording about the first concept',
        tags: ['alpha'],
      }),
      candidate({
        id: 2,
        stem: 'Shared alpha wording about the second concept',
        tags: ['alpha'],
      }),
      candidate({
        id: 3,
        stem: 'Different beta wording considers another topic',
        tags: ['beta'],
      }),
      candidate({
        id: 4,
        stem: 'Completely separate gamma scenario',
        tags: ['gamma'],
      }),
    ]

    const selected = selectLecturerRatingFamilies(candidates, 3)

    expect(selected.map((item) => item.id).sort()).toEqual([1, 3, 4])
  })

  it('caps each format separately and retains sparse formats', () => {
    const candidates = [
      ...Array.from({ length: 3 }, (_, index) =>
        candidate({
          id: index + 1,
          stem: `SC question ${index + 1}`,
        })
      ),
      ...Array.from({ length: 14 }, (_, index) =>
        candidate({
          id: index + 101,
          format: 'KPRIM',
          stem: `KPRIM question ${index + 1}`,
        })
      ),
    ]

    const selected = selectLecturerRatingFamilies(candidates, 50)

    expect(selected.filter((item) => item.format === 'SC')).toHaveLength(3)
    expect(selected.filter((item) => item.format === 'KPRIM')).toHaveLength(10)
  })
})
