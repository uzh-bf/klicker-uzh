const reorder = (list, sourceIndex, destIndex) => {
  const result = Array.from(list)
  const [removed] = result.splice(sourceIndex, 1)
  result.splice(destIndex, 0, removed)
  return result
}

const move = (blocks, srcId, srcIx, dstId, dstIx) => {
  // find indices of source and destination blocks
  const srcBlockIndex = blocks.findIndex(block => block.id === srcId)
  const dstBlockIndex = blocks.findIndex(block => block.id === dstId)

  // save and remove the question that is to be moved
  const targetQuestion = blocks.getIn([srcBlockIndex, 'questions', srcIx])
  const blocksWithoutSrc = blocks.deleteIn([srcBlockIndex, 'questions', srcIx])

  // insert the target questions into the destination block
  const dstQuestionsWithTarget = blocksWithoutSrc
    .getIn([dstBlockIndex, 'questions'])
    .insert(dstIx, targetQuestion)
  const blocksWithTarget = blocksWithoutSrc.setIn(
    [dstBlockIndex, 'questions'],
    dstQuestionsWithTarget,
  )

  // return the result
  return blocksWithTarget
}

export { reorder, move }
