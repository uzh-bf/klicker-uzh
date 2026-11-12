import { GraphQLError } from 'graphql'

export function adaptivePracticeQuizError(message: string, code: string) {
  return new GraphQLError(message, { extensions: { code } })
}
