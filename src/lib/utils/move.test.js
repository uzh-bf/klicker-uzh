import { List } from 'immutable'

import { moveQuestion, getIndex } from './move'

describe('move', () => {
  it('can reorder', () => {
    const blocks = List([
      {
        id: 'ba',
        questions: List([
          { id: 'qa', content: 'bla' },
          { id: 'qb', content: 'blu' },
          { id: 'qc', content: 'blee' },
          { id: 'qd', content: 'blii' },
        ]),
      },
    ])
    const reordered = moveQuestion(blocks, 'ba', 1, 'ba', 3)
    expect(reordered.get(0).questions.size).toEqual(4)
    expect(reordered).toMatchSnapshot()
  })

  it('can move', () => {
    const blocks = List([
      {
        id: 'ba',
        questions: List([
          { id: 'qa', content: 'bla' },
          { id: 'qb', content: 'blu' },
          { id: 'qc', content: 'blab' },
          { id: 'qd', content: 'bli' },
        ]),
      },
      {
        id: 'bb',
        questions: List([
          { id: 'qe', content: 'bleb' },
          { id: 'qf', content: 'blaa' },
          { id: 'qg', content: 'blaaa' },
        ]),
      },
      {
        id: 'bc',
        questions: List([
          { id: 'qh', content: 'blaaaa' },
          { id: 'qi', content: 'blabb' },
        ]),
      },
      {
        id: 'bd',
        question: List([{ id: 'qj', content: 'blub' }]),
      },
    ])

    expect(blocks).toMatchSnapshot('#0 initial state')

    // evaluate question movements
    const moved = moveQuestion(blocks, 'bc', 1, 'ba', 3)
    expect(moved).toMatchSnapshot('#1 move c-1 to a-3')

    const moved2 = moveQuestion(moved, 'bc', 0, 'ba', 0, true)
    expect(moved2).toMatchSnapshot('#2 move c-0 to a-0')

    const moved3 = moveQuestion(moved2, 'bb', 1, 'ba', 0)
    expect(moved3).toMatchSnapshot('#3 move b-1 to c-0')

    const moved4 = moveQuestion(moved3, 'bd', 0, 'ba', 0)
    expect(moved4).toMatchSnapshot('#4 move d-0 to a-0')
  })
})
