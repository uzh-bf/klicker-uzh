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
          { id: 'f', content: 'blee' },
          { id: 'g', content: 'blii' },
        ]),
      },
    ])
    const reordered = move(blocks, 'a', 1, 'a', 3)
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

    const moved = move(blocks, 'c', 1, 'a', 3)
    expect(moved).toMatchSnapshot()
  })
})
