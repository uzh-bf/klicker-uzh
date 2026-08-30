import type { CodegenConfig } from '@graphql-codegen/cli'
import { printSchema } from 'graphql'
import { schema } from './src/index.js'

const ensureSchemaTrailingNewline = (path: string, content: string) =>
  path.endsWith('src/public/schema.graphql') && !content.endsWith('\n')
    ? `${content}\n`
    : content

const config: CodegenConfig = {
  schema: printSchema(schema),
  // schema: 'src/graphql/schema.graphql',
  documents: ['src/graphql/ops/**/*.graphql'],
  generates: {
    './src/ops.ts': {
      // preset: 'client',
      plugins: [
        'typescript',
        'typescript-operations',
        'typed-document-node',
        'fragment-matcher',
      ],
      config: {
        avoidOptionals: false,
        useTypeImports: true,
      },
    },
    './src/public/schema.graphql': {
      plugins: ['schema-ast'],
      config: {
        includeDirectives: true,
      },
    },
    // './src/persisted-queries/client.json': {
    //   plugins: [
    //     {
    //       'graphql-codegen-persisted-query-ids': {
    //         output: 'client',
    //         algorithm: 'sha256',
    //       },
    //     },
    //   ],
    // },
    // './src/persisted-queries/server.json': {
    //   plugins: [
    //     {
    //       'graphql-codegen-persisted-query-ids': {
    //         output: 'server',
    //         algorithm: 'sha256',
    //       },
    //     },
    //   ],
    // },
    './src/public/client.json': {
      plugins: [
        {
          'graphql-codegen-persisted-query-ids': {
            output: 'client',
            algorithm: 'sha256',
          },
        },
      ],
    },
    './src/public/server.json': {
      plugins: [
        {
          'graphql-codegen-persisted-query-ids': {
            output: 'server',
            algorithm: 'sha256',
          },
        },
      ],
    },
  },
  hooks: {
    beforeOneFileWrite: ensureSchemaTrailingNewline,
  },
}

export default config
