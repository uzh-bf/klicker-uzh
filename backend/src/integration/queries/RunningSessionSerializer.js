module.exports = {
  test: (data) => data && !!data.runningSession,
  print: ({ runningSession: { activeStep, confusionTS, feedbacks, blocks, settings } }) => `
    runningSession {
      activeStep: ${activeStep}
      feedbacks: ${feedbacks.map(
        ({ content, votes }) => `
        content: ${content}
        votes: ${votes}
      `
      )}
      blocks: ${blocks.map(
        ({ status, instances }) => `
        status: ${status}
        instances: ${instances.map(
          ({ isOpen, question, version }) => `
          isOpen: ${isOpen}
          version: ${version}
          question {
            title: ${question.title}
            type: ${question.type}
          }
        `
        )}
      `
      )}
      settings: ${JSON.stringify(settings)}
    }
  `,
}
