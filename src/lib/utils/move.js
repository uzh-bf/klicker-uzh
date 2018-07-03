const getIndex = (blocks, droppableId) => blocks.findIndex(block => block.id === droppableId.split('-')[1])

export default (blocks, srcId, srcIx, dstId, dstIx) => {
  // find indices of source and destination blocks
  const srcBlockIndex = getIndex(blocks, srcId)
  const dstBlockIndex = getIndex(blocks, dstId)

  // save and remove the question that is to be moved
  const targetQuestion = blocks.getIn([srcBlockIndex, 'questions', srcIx])
  const blocksWithoutSrc = blocks.deleteIn([srcBlockIndex, 'questions', srcIx])

  // compute the new list of questions for the target block
  const dstQuestionsWithTarget = blocksWithoutSrc
    .getIn([dstBlockIndex, 'questions'])
    .insert(dstIx, targetQuestion)

  // update the target block
  const result = blocksWithoutSrc.setIn(
    [dstBlockIndex, 'questions'],
    dstQuestionsWithTarget,
  )

  return result
}
