module.exports = {
  projects: {
    graphql: {
      schema: ['packages/graphql/src/graphql/schema.graphql'],
      documents: ['packages/graphql/src/graphql/ops/**/*.{graphql}'],
    },
  },
}
