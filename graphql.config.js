module.exports = {
  projects: {
    graphql: {
      schema: ['packages/graphql/src/public/schema.graphql'],
      documents: ['packages/graphql/src/graphql/ops/**/*.{graphql}'],
    },
  },
}
