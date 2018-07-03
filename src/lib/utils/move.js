function getIndex(blocks, droppableId) {
  return blocks.findIndex(block => block.id === droppableId)
}

function moveQuestion(blocks, srcBlockId, srcQuestionIx, dstBlockId, dstQuestionIx, removeEmpty = false) {
  // compute the index for both source and destination block
  const srcBlockIx = getIndex(blocks, srcBlockId)
  const dstBlockIx = getIndex(blocks, dstBlockId)

  console.log(blocks.toJS(), srcBlockIx, srcQuestionIx, dstBlockIx, dstQuestionIx)

  // save and remove the question that is to be moved
  const targetQuestion = blocks.getIn([srcBlockIx, 'questions', srcQuestionIx])
  let blocksWithoutSrc = blocks.deleteIn([srcBlockIx, 'questions', srcQuestionIx])

  console.log(blocksWithoutSrc.toJS())

  // if the source block is empty because ot the move, remove it entirely
  // expect if source and destination are the same!
  if (removeEmpty && srcBlockId !== dstBlockId && blocksWithoutSrc.getIn([srcBlockIx, 'questions']).size === 0) {
    blocksWithoutSrc = blocksWithoutSrc.delete(srcBlockIx)
  }

  // compute the new list of questions for the target block
  const dstQuestionsWithTarget = blocksWithoutSrc.getIn([dstBlockIx, 'questions']).insert(dstQuestionIx, targetQuestion)

  // update the target block
  return blocksWithoutSrc.setIn([dstBlockIx, 'questions'], dstQuestionsWithTarget)
}

export { moveQuestion }
