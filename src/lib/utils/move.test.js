import { List } from 'immutable'

import { reorder, move } from './move'

describe.only('move', () => {
  it('can reorder', () => {
    const singleBlock = [
      { id: 'a', content: 'bla' },
      { id: 'b', content: 'blu' },
      { id: 'f', content: 'blee' },
      { id: 'g', content: 'blii' },
    ]
    const reordered = reorder(singleBlock, 1, 3)
    expect(reordered.length).toEqual(4)
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

    expect(blocks).toMatchSnapshot()

    const moved = move(blocks, 'c', 1, 'a', 3)
    expect(moved).toMatchSnapshot()
    expect(blocks).toMatchSnapshot()
  })
})
