import UUIDv4 from 'uuid/v4'

export function updateArrayElement(array, index, newValue): any[] {
  const oldValue = array[index]

  if (typeof oldValue === 'object') {
    return [...array.slice(0, index), { ...oldValue, ...newValue }, ...array.slice(index + 1)]
  }

  return [...array.slice(0, index), newValue, ...array.slice(index + 1)]
}

export function deleteArrayElement(array, index): any[] {
  return [...array.slice(0, index), ...array.slice(index + 1)]
}

export function reorder(list, startIndex, endIndex): any[] {
  const result = Array.from(list)
  const [removed] = result.splice(startIndex, 1)
  result.splice(endIndex, 0, removed)
  return result
}

export function handleDragEnd(array, onChange): void {
  return result => {
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
 * Compute the index of a block in an immutable list given its id
 * @param {*} blocks
 * @param {*} droppableId
 */
export function getIndex(blocks, droppableId): number {
  return blocks.findIndex(block => block.id === droppableId)
}

/**
 * Extend a block with a new question
 * Either at a specific index or by appending to the end
 * @param {*} blocks
 * @param {*} blockId
 * @param {*} question
 * @param {*} targetIndex Optional index that specifies the target location of the question
 */
export function addToBlock(blocks, blockId, question, targetIndex = null): any[] {
  let dstBlockIx = blockId

  // if the blockId passed is not number (index)
  // assume it can be calculated by searching for the id
  if (typeof blockId !== 'number') {
    dstBlockIx = getIndex(blocks, blockId)
  }

  // compute the new list of questions for the target block
  const dstQuestions = blocks.getIn([dstBlockIx, 'questions'])
  const dstQuestionsWithTarget =
    typeof targetIndex !== 'undefined'
      ? dstQuestions.insert(targetIndex, { ...question, key: UUIDv4() })
      : dstQuestions.push({ ...question, key: UUIDv4() })

  // update the target block
  return blocks.setIn([dstBlockIx, 'questions'], dstQuestionsWithTarget)
}

/**
 * Append an entirely new block for a new question
 * @param {*} blocks
 * @param {*} question
 */
export function appendNewBlock(blocks, question): any[] {
  return blocks.push({
    id: UUIDv4(),
    questions: [{ ...question, key: UUIDv4() }],
  })
}

/**
 * Remove a question from a block
 * @param {ImmutableList} blocks
 * @param {int} blockIndex
 * @param {int} questionIndex
 * @param {bool} removeEmpty
 */
export function removeQuestion(blocks, blockIndex, questionIndex, removeEmpty = false): any[] {
  // delete the question with the specified index from the specified block
  const blocksWithoutQuestion = blocks.deleteIn([blockIndex, 'questions', questionIndex])

  // if the block from which the question was removed is now empty, remove the block
  if (removeEmpty && blocksWithoutQuestion.getIn([blockIndex, 'questions']).size === 0) {
    return blocksWithoutQuestion.delete(blockIndex)
  }

  return blocksWithoutQuestion
}

/**
 * Move an existing question from one list to another list
 * @param {ImmutableList} blocks
 * @param {*} srcBlockId
 * @param {*} srcQuestionIx
 * @param {*} dstBlockId
 * @param {*} dstQuestionIx
 * @param {*} removeEmpty Flag that specifies whether empty blocks should be pruned
 */
export function moveQuestion(blocks, srcBlockId, srcQuestionIx, dstBlockId, dstQuestionIx, removeEmpty = false): any[] {
  // compute the index for both source and destination block
  const srcBlockIx = getIndex(blocks, srcBlockId)
  let dstBlockIx = getIndex(blocks, dstBlockId)

  // save and remove the question that is to be moved
  const targetQuestion = blocks.getIn([srcBlockIx, 'questions', srcQuestionIx])
  const blocksWithoutSrc = removeQuestion(blocks, srcBlockIx, srcQuestionIx, removeEmpty && srcBlockId !== dstBlockId)

  // if the destination block comes after the source block
  // the destination index needs to be updated after the removal of the source block
  // as everything shifts by one block
  if (blocks.size > blocksWithoutSrc.size && dstBlockIx > srcBlockIx) {
    dstBlockIx -= 1
  }

  return addToBlock(blocksWithoutSrc, dstBlockIx, targetQuestion, dstQuestionIx)
}
