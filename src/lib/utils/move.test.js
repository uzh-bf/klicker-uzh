import { List } from 'immutable'

import { moveQuestion, appendNewBlock, addToBlock, removeQuestion } from './move'

describe('move', () => {
  const blocks = List([
    {
      id: 'ba',
      questions: List([
        { content: 'bla', id: 'qa' },
        { content: 'blu', id: 'qb' },
        { content: 'blab', id: 'qc' },
        { content: 'bli', id: 'qd' },
      ]),
    },
    {
      id: 'bb',
      questions: List([{ content: 'bleb', id: 'qe' }, { content: 'blaa', id: 'qf' }, { content: 'blaaa', id: 'qg' }]),
    },
    {
      id: 'bc',
      questions: List([{ content: 'blaaaa', id: 'qh' }, { content: 'blabb', id: 'qi' }]),
    },
    {
      id: 'bd',
      questions: List([{ content: 'blub', id: 'qj' }]),
    },
  ])

  it('can reorder questions within blocks', () => {
    const reordered = moveQuestion(blocks, 'ba', 1, 'ba', 3)
    expect(reordered.getIn([0, 'questions']).size).toEqual(4)
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
    expect(blocks.getIn([3, 'questions']).size).toEqual(1)

    const extendedBlocks = addToBlock(blocks, 'bd', {
      content: 'blaNew',
      id: 'qk',
    })

    expect(extendedBlocks.getIn([3, 'questions']).size).toEqual(2)
  })

  it('can append blocks with new questions', () => {
    expect(blocks.size).toEqual(4)

    const appendedBlocks = appendNewBlock(blocks, {
      content: 'blaNew',
      id: 'ql',
    })

    expect(appendedBlocks.size).toEqual(5)
  })

  it('can remove questions from blocks', () => {
    expect(blocks.size).toEqual(4)

    const blocksWithoutQuestion = removeQuestion(blocks, 2, 0, false)
    expect(blocksWithoutQuestion.size).toEqual(4)
    expect(blocksWithoutQuestion.getIn([2, 'questions']).size).toEqual(1)

    const blocksWithoutQuestion2 = removeQuestion(blocksWithoutQuestion, 2, 0, false)
    expect(blocksWithoutQuestion2.size).toEqual(4)
    expect(blocksWithoutQuestion2.getIn([2, 'questions']).size).toEqual(0)

    const blocksWithoutQuestion3 = removeQuestion(blocksWithoutQuestion2, 3, 0, true)
    expect(blocksWithoutQuestion3.size).toEqual(3)
  })
})
