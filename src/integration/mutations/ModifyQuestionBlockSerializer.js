module.exports = {
  test: (data) => data && !!data.modifyQuestionBlock,
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
