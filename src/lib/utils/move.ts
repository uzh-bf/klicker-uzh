import { v4 as UUIDv4 } from 'uuid'
import _get from 'lodash/get'

export function insertArrayElement(array: any[], index: number, value: any, replace = false): any[] {
  return [...array.slice(0, index), value, ...array.slice(replace ? index + 1 : index)]
}

export function updateArrayElement(array: any[], index: number, newValue: any): any[] {
  const oldValue = array[index]

  if (typeof oldValue === 'object') {
    return insertArrayElement(array, index, { ...oldValue, ...newValue }, true)
  }

  return insertArrayElement(array, index, newValue, true)
}

export function deleteArrayElement(array: any[], index: number): any[] {
  return [...array.slice(0, index), ...array.slice(index + 1)]
}

export function reorder(list: any[], startIndex: number, endIndex: number): any[] {
  const result = Array.from(list)
  const [removed] = result.splice(startIndex, 1)
  result.splice(endIndex, 0, removed)
  return result
}

export function handleDragEnd(array: any, onChange: Function): Function {
  return (result: any): void => {
    if (!result.destination) {
      return
    }

    if (result.destination.index === result.source.index) {
      return
    }

    onChange(reorder(array, result.source.index, result.destination.index))
  }
}

/**
 * Compute the index of a block in a list given its id
 */
export function getIndex(blocks: any[], droppableId: string): number {
  return blocks.findIndex((block): boolean => block.id === droppableId)
}

/**
 * Extend a block with a new question
 * Either at a specific index or by appending to the end
 */
export function addToBlock(blocks: any[], blockId: string | number, question: any, targetIndex: number = null): any[] {
  let dstBlockIx: string | number = blockId

  // if the blockId passed is not number (index)
  // assume it can be calculated by searching for the id
  if (typeof blockId !== 'number') {
    dstBlockIx = getIndex(blocks, blockId)
  }

  // compute the new list of questions for the target block
  const targetValue = { ...question, key: UUIDv4() }
  const dstQuestions: any[] = [..._get(blocks, `${dstBlockIx}.questions`)]
  const dstQuestionsWithTarget =
    typeof targetIndex !== 'undefined' && targetIndex !== null
      ? insertArrayElement(dstQuestions, targetIndex, targetValue)
      : [...dstQuestions, targetValue]

  // update the target block
  const newBlocks = [...blocks]
  newBlocks[dstBlockIx].questions = dstQuestionsWithTarget
  return newBlocks
}

/**
 * Append an entirely new block for a new question
 */
export function appendNewBlock(blocks: any[], question: any): any[] {
  return [
    ...blocks,
    {
      id: UUIDv4(),
      questions: [{ ...question, key: UUIDv4() }],
    },
  ]
}

/**
 * Remove a question from a block
 */
export function removeQuestion(blocks: any[], blockIndex: number, questionIndex: number, removeEmpty = false): any[] {
  // delete the question with the specified index from the specified block
  const blocksWithoutQuestion = [...blocks]
  blocksWithoutQuestion[blockIndex].questions = deleteArrayElement(
    _get(blocks, `${blockIndex}.questions`),
    questionIndex
  )

  // if the block from which the question was removed is now empty, remove the block
  if (removeEmpty && _get(blocksWithoutQuestion, `${blockIndex}.questions`).length === 0) {
    return deleteArrayElement(blocksWithoutQuestion, blockIndex)
  }

  return blocksWithoutQuestion
}

/**
 * Move an existing question from one list to another list
 * @param {*} removeEmpty Flag that specifies whether empty blocks should be pruned
 */
export function moveQuestion(
  blocks: any[],
  srcBlockId: string,
  srcQuestionIx: number,
  dstBlockId: string,
  dstQuestionIx: number,
  removeEmpty = false
): any[] {
  console.log(blocks, srcBlockId, srcQuestionIx, dstBlockId, dstQuestionIx)

  // compute the index for both source and destination block
  const srcBlockIx = getIndex(blocks, srcBlockId)
  let dstBlockIx = getIndex(blocks, dstBlockId)

  // save and remove the question that is to be moved
  const targetQuestion = _get(blocks, `${srcBlockIx}.questions.${srcQuestionIx}`)
  const blocksWithoutSrc = removeQuestion(blocks, srcBlockIx, srcQuestionIx, removeEmpty && srcBlockId !== dstBlockId)

  // if the destination block comes after the source block
  // the destination index needs to be updated after the removal of the source block
  // as everything shifts by one block
  if (blocks.length > blocksWithoutSrc.length && dstBlockIx > srcBlockIx) {
    dstBlockIx -= 1
  }

  return addToBlock(blocksWithoutSrc, dstBlockIx, targetQuestion, dstQuestionIx)
}
