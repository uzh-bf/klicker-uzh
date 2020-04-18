const { draftContentSerializer } = require('../../lib/test/serializers')

module.exports = {
  test: (data) => data && !!data.question,
  print: ({ question: { title, type, instances, tags, versions } }) => `
    question {
      title: ${title}
      type: ${type}
      tags: ${JSON.stringify(tags.map((tag) => tag.name))}

      instances: ${instances.length}
      versions: ${versions.map(
        ({ content, description, options, solution }) => `
        content: ${draftContentSerializer(content)}
        description: ${description}
        options: ${JSON.stringify(options)}
        solution: ${JSON.stringify(solution)}
      `
      )}
    }
  `,
}
