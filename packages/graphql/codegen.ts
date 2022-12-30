import type { CodegenConfig } from '@graphql-codegen/cli'
import { printSchema } from 'graphql'
import { schema } from './src/pothos'

const config: CodegenConfig = {
  schema: printSchema(schema),
  documents: ['src/graphql/ops/**/*.graphql'],
  generates: {
    './src/ops.ts': {
      // preset: 'client',
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-resolvers',
        'typed-document-node',
        'fragment-matcher',
      ],
    },
    './src/ops.schema.json': {
      plugins: ['introspection'],
    },
    './src/graphql/schema.graphql': {
      plugins: ['schema-ast'],
    },
  },
}

export default config
