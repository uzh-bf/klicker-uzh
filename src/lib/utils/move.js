import UUIDv4 from 'uuid/v4'
import { List } from 'immutable'

/**
 * Compute the index of a block in an immutable list given its id
 * @param {*} blocks
 * @param {*} droppableId
 */
function getIndex(blocks, droppableId) {
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
function addToBlock(blocks, blockId, question, targetIndex = null) {
  let dstBlockIx = blockId

  // if the blockId passed is not number (index)
  // assume it can be calculated by searching for the id
  if (typeof blockId !== 'number') {
    dstBlockIx = getIndex(blocks, blockId)
  }

  // compute the new list of questions for the target block
  const dstQuestions = blocks.getIn([dstBlockIx, 'questions'])
  const dstQuestionsWithTarget = typeof targetIndex !== 'undefined'
    ? dstQuestions.insert(targetIndex, question)
    : dstQuestions.push(question)

  // update the target block
  return blocks.setIn([dstBlockIx, 'questions'], dstQuestionsWithTarget)
}

/**
 * Append an entirely new block for a new question
 * @param {*} blocks
 * @param {*} question
 */
function appendNewBlock(blocks, question) {
  return blocks.push({
    id: UUIDv4(),
    questions: List([question]),
  })
}

/**
 * Move an existing question from one list to another list
 * @param {*} blocks
 * @param {*} srcBlockId
 * @param {*} srcQuestionIx
 * @param {*} dstBlockId
 * @param {*} dstQuestionIx
 * @param {*} removeEmpty Flag that specifies whether empty blocks should be pruned
 */
function moveQuestion(
  blocks,
  srcBlockId,
  srcQuestionIx,
  dstBlockId,
  dstQuestionIx,
  removeEmpty = false,
) {
  // compute the index for both source and destination block
  const srcBlockIx = getIndex(blocks, srcBlockId)
  let dstBlockIx = getIndex(blocks, dstBlockId)

  // save and remove the question that is to be moved
  const targetQuestion = blocks.getIn([srcBlockIx, 'questions', srcQuestionIx])
  let blocksWithoutSrc = blocks.deleteIn([
    srcBlockIx,
    'questions',
    srcQuestionIx,
  ])

  // if the source block is empty because ot the move, remove it entirely
  // expect if source and destination are the same!
  if (
    removeEmpty
    && srcBlockId !== dstBlockId
    && blocksWithoutSrc.getIn([srcBlockIx, 'questions']).size === 0
  ) {
    blocksWithoutSrc = blocksWithoutSrc.delete(srcBlockIx)

    // if the destination block comes after the source block
    // the destination index needs to be updated after the removal of the source block
    // as everything shifts by one block
    if (dstBlockIx > srcBlockIx) {
      dstBlockIx -= 1
    }
  }

  return addToBlock(blocksWithoutSrc, dstBlockIx, targetQuestion, dstQuestionIx)
}

export { moveQuestion, addToBlock, appendNewBlock }
