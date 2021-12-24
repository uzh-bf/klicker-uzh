module.exports = {
  test: (data) => data && !!data.archiveQuestions,
  print: ({ archiveQuestions }) => `
    archiveQuestions: [${archiveQuestions.map(
      ({ isArchived }) => `
      isArchived: ${isArchived}
    `
    )}]
  `,
}
