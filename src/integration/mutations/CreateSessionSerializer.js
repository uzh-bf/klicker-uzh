module.exports = {
  test: ({ createSession, modifySession }) => !!createSession || !!modifySession,
  print: ({ createSession, modifySession }) => {
    const { confusionTS, feedbacks, blocks, settings } = createSession || modifySession

    return `
    createSession / modifySession {
      confusionTS: ${confusionTS}
      feedbacks: ${feedbacks}
      blocks: ${blocks.map(
        ({ status, instances }) => `
        status: ${status}
        instances: ${instances.map(
          ({ question }) => `
          title: ${question.title}
          type: ${question.type}
        `
        )}
      `
      )}
      settings: ${JSON.stringify(settings)}
    }
  `
  },
}
