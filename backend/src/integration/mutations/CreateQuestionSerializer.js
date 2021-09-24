const { draftContentSerializer } = require('../../lib/test/serializers')

module.exports = {
  test: (data) => data && (!!data.createQuestion || !!data.modifyQuestion),
  print: ({ createQuestion, modifyQuestion }) => {
    const { title, type, tags, versions } = createQuestion || modifyQuestion

    return `
    createQuestion / modifyQuestion {
      title: ${title}
      type: ${type}
      tags: ${tags.map((tag) => tag.name)}
      versions: ${versions.map(
        ({ content, description, options, solution }) => `
        content: ${draftContentSerializer(content)}
        description: ${description}
        options: ${JSON.stringify(options)}
        solution: ${JSON.stringify(solution)}
      `
      )}
    }
  `
  },
}
