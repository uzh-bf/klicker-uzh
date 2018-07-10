function getIndex(blocks, droppableId) {
  return blocks.findIndex(block => block.id === droppableId)
}

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

  // compute the new list of questions for the target block
  const dstQuestionsWithTarget = blocksWithoutSrc
    .getIn([dstBlockIx, 'questions'])
    .insert(dstQuestionIx, targetQuestion)

  // update the target block
  return blocksWithoutSrc.setIn(
    [dstBlockIx, 'questions'],
    dstQuestionsWithTarget,
  )
}

export { moveQuestion }
