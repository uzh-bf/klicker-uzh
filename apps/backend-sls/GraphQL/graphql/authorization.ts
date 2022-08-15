import { preExecRule } from '@graphql-authz/core'

const IsAuthenticated = preExecRule()((ctx: any) => {
  return !!ctx.user
})

export const Rules = {
  IsAuthenticated,
}

export const AuthSchema = {
  Mutation: {
    '*': { __authz: { rules: ['Reject'] } },
    login: { __authz: { rules: ['Allow'] } },
  },
  Query: {
    '*': { __authz: { rules: ['Reject'] } },
    // learningElement: { __authz: { rules: ['IsAuthenticated'] } },
  },
}
