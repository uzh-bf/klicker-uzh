import express from 'express'
import { createServer } from '@graphql-yoga/node'

const app = express()

const graphQLServer = createServer({
  schema: {
    typeDefs: /* GraphQL */ `
      scalar File
      type Query {
        hello: String
      }
      type Mutation {
        getFileName(file: File!): String
      }
    `,
    resolvers: {
      Query: {
        hello: () => 'world',
      },
      Mutation: {
        getFileName: (root, { file }: { file: File }) => file.name,
      },
    },
  },
  logging: false,
  graphiql: {
    endpoint: '/api/graphql',
  },
})

app.use('/api/graphql', graphQLServer)

export default app
