const { draftContentSerializer } = require('../../lib/test/serializers')

module.exports = {
  test: (data) => data && !!data.joinSession,
  print: ({ joinSession: { settings, activeInstances, feedbacks } }) => `
    joinSession {
      settings: ${JSON.stringify(settings)}
      activeInstances: ${activeInstances.map(
        ({ title, content, description, type, options }) => `
        title: ${title}
        content: ${draftContentSerializer(content)}
        description: ${description}
        type: ${type}
        options: ${JSON.stringify(options)}
      `
      )}
      feedbacks: ${
        feedbacks &&
        feedbacks.map(
          ({ content, votes }) => `
        content: ${content}
        votes: ${votes}
      `
        )
      }
    }
  `,
}
