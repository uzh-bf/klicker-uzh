import { List } from 'immutable'

import move from './move'

describe.only('move', () => {
  it('can reorder', () => {
    const blocks = List([
      {
        id: 'a',
        questions: List([
          { id: 'a', content: 'bla' },
          { id: 'b', content: 'blu' },
          { id: 'c', content: 'blee' },
          { id: 'd', content: 'blii' },
        ]),
      },
    ])
    const reordered = move(blocks, 'b-a', 1, 'b-a', 3)
    expect(reordered.get(0).questions.size).toEqual(4)
    expect(reordered).toMatchSnapshot()
  })

  it('can move', () => {
    const blocks = List([
      {
        id: 'a',
        questions: List([
          { id: 'a', content: 'bla' },
          { id: 'b', content: 'blu' },
          { id: 'c', content: 'blab' },
          { id: 'd', content: 'bli' },
        ]),
      },
      {
        id: 'b',
        questions: List([
          { id: 'e', content: 'bleb' },
          { id: 'f', content: 'blaa' },
          { id: 'g', content: 'blaaa' },
        ]),
      },
      {
        id: 'c',
        questions: List([
          { id: 'h', content: 'blaaaa' },
          { id: 'i', content: 'blabb' },
        ]),
      },
    ])

    expect(blocks).toMatchSnapshot('#0 initial state')

    const moved = move(blocks, 'b-c', 1, 'b-a', 3)
    expect(moved).toMatchSnapshot('#1 move c-1 to a-3')

    const moved2 = move(moved, 'b-c', 0, 'b-a', 0)
    expect(moved2).toMatchSnapshot('#2 move c-0 to a-0')

    const moved3 = move(moved2, 'b-b', 1, 'b-c', 0)
    expect(moved3).toMatchSnapshot('#3 move b-1 to c-0')
  })
})
