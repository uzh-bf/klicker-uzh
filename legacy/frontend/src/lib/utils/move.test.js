import _get from 'lodash/get'

import { addToBlock, appendNewBlock, moveQuestion, removeQuestion } from './move'

describe('move', () => {
  const blocks = [
    {
      id: 'ba',
      questions: [
        { content: 'bla', id: 'qa' },
        { content: 'blu', id: 'qb' },
        { content: 'blab', id: 'qc' },
        { content: 'bli', id: 'qd' },
      ],
    },
    {
      id: 'bb',
      questions: [
        { content: 'bleb', id: 'qe' },
        { content: 'blaa', id: 'qf' },
        { content: 'blaaa', id: 'qg' },
      ],
    },
    {
      id: 'bc',
      questions: [
        { content: 'blaaaa', id: 'qh' },
        { content: 'blabb', id: 'qi' },
      ],
    },
    {
      id: 'bd',
      questions: [{ content: 'blub', id: 'qj' }],
    },
  ]

  it('can reorder questions within blocks', () => {
    const reordered = moveQuestion(blocks, 'ba', 1, 'ba', 3)
    expect(_get(reordered, '0.questions').length).toEqual(4)
  })

  it.skip('can move questions between blocks', () => {
    // evaluate question movements
    // TODO: add tests
    const moved = moveQuestion(blocks, 'bc', 1, 'ba', 3)
    const moved2 = moveQuestion(moved, 'bc', 0, 'ba', 0, true)
    const moved3 = moveQuestion(moved2, 'bb', 1, 'ba', 0)
    const moved4 = moveQuestion(moved3, 'bd', 0, 'ba', 0) // eslint-disable-line
  })

  it('can extend blocks with new questions', () => {
    expect(_get(blocks, '3.questions').length).toEqual(1)

    const extendedBlocks = addToBlock(blocks, 'bd', {
      content: 'blaNew',
      id: 'qk',
    })

    expect(_get(extendedBlocks, '3.questions').length).toEqual(2)
  })

  it('can append blocks with new questions', () => {
    expect(blocks.length).toEqual(4)

    const appendedBlocks = appendNewBlock(blocks, {
      content: 'blaNew',
      id: 'ql',
    })

    expect(appendedBlocks.length).toEqual(5)
  })

  it('can remove questions from blocks', () => {
    expect(blocks.length).toEqual(4)

    const blocksWithoutQuestion = removeQuestion(blocks, 2, 0, false)
    expect(blocksWithoutQuestion.length).toEqual(4)
    expect(_get(blocksWithoutQuestion, '2.questions').length).toEqual(1)

    const blocksWithoutQuestion2 = removeQuestion(blocksWithoutQuestion, 2, 0, false)
    expect(blocksWithoutQuestion2.length).toEqual(4)
    expect(_get(blocksWithoutQuestion2, '2.questions').length).toEqual(0)

    expect(_get(blocksWithoutQuestion2, '3.questions').length).toEqual(2)
    const blocksWithoutQuestion3 = removeQuestion(blocksWithoutQuestion2, 3, 0, true)
    expect(_get(blocksWithoutQuestion2, '3.questions').length).toEqual(1)
    expect(blocksWithoutQuestion3.length).toEqual(4)
  })
})
