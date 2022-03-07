module.exports = {
  test: (data) => data && (!!data.createSession || !!data.modifySession || !!data.resetQuestionBlock),
  print: ({ createSession, modifySession, resetQuestionBlock }) => {
    const { feedbacks, blocks, settings, participants } = createSession || modifySession || resetQuestionBlock

    return `
    createSession / modifySession {
      feedbacks: ${feedbacks}
      blocks: [${blocks.map(
        ({ status, instances }) => `
        status: ${status}
        instances: ${instances.map(
          ({ question }) => `
          title: ${question.title}
          type: ${question.type}
        `
        )}
      `
      )}]
      participants: [${participants.map(
        ({ username }) => `
          username: ${username},
      `
      )}]
      settings: ${JSON.stringify(settings)}
    }
  `
  },
}
