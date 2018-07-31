module.exports = {
  test: ({ archiveQuestions }) => !!archiveQuestions,
  print: ({ archiveQuestions }) => `
    archiveQuestions: [${archiveQuestions.map(
      ({ isArchived }) => `
      isArchived: ${isArchived}
    `
    )}]
  `,
}
