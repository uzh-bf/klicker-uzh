module.exports = {
  test: (data) => data && !!data.sessionPublic,
  print: ({ sessionPublic: { status, blocks } }) => `
    evaluateSession {
      status: ${status}
      blocks: ${blocks.map(
        ({ status: status2, instances }) => `
        status: ${status2}
        instances: ${instances.map(
          ({ isOpen, version, question, results, responses }) => `
          isOpen: ${isOpen}
          version: ${version}
          question {
            title: ${question.title}
            type: ${question.type}
            versions: ${question.versions.map(
              ({ description, options }) => `
              description: ${description}
              options: ${JSON.stringify(options)}
            `
            )}
          }
          results: ${JSON.stringify(results)}
          responses: ${responses && responses.map((response) => response.value)}
        `
        )}
      `
      )}
    }
  `,
}
