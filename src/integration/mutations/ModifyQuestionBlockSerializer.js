module.exports = {
  test: ({ modifyQuestionBlock }) => !!modifyQuestionBlock,
  print: ({ modifyQuestionBlock: { blocks } }) => `
    modifyQuestionBlock {
      blocks: ${blocks.map(
        ({ timeLimit, expiresAt }) => `
        timeLimit: ${timeLimit}
        expiresAt: ${expiresAt}
      `
      )}
    }
  `,
}
