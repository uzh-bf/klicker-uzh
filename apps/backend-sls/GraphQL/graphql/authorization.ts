import { or, preExecRule } from '@graphql-authz/core'
import { UserRole } from '@klicker-uzh/prisma'

const IsAuthenticated = preExecRule()((ctx: any) => {
  return !!ctx.user
})

const IsParticipant = preExecRule()((ctx: any) => {
  return ctx.user && ctx.user.role === UserRole.PARTICIPANT
})

const IsUser = preExecRule()((ctx: any) => {
  return ctx.user && ctx.user.role === UserRole.USER
})

const IsAdmin = preExecRule()((ctx: any) => {
  return ctx.user && ctx.user.role === UserRole.ADMIN
})

const IsUserOrAdmin = or(IsUser, IsAdmin)

export const Rules = {
  IsAuthenticated,
  IsParticipant,
  IsUser,
  IsAdmin,
  IsUserOrAdmin,
}

export const AuthSchema = {
  Mutation: {
    '*': { __authz: { rules: ['Reject'] } },
    loginUser: { __authz: { rules: ['Allow'] } },
    loginParticipant: { __authz: { rules: ['Allow'] } },
    registerParticipantFromLTI: { __authz: { rules: ['Allow'] } },
    createCourse: { __authz: { rules: ['IsUserOrAdmin'] } },
    createSession: { __authz: { rules: ['IsUserOrAdmin'] } },
    joinCourse: { __authz: { rules: ['IsParticipant'] } },
    leaveCourse: { __authz: { rules: ['IsParticipant'] } },
    startSession: { __authz: { rules: ['IsUserOrAdmin'] } },
  },

  Query: {
    '*': { __authz: { rules: ['Reject'] } },
    learningElement: { __authz: { rules: ['Allow'] } },
    feedbacks: { __authz: { rules: ['Allow'] } },
    getCourseOverviewData: { __authz: { rules: ['Allow'] } },
    participations: { __authz: { rules: ['IsParticipant'] } },
    self: { __authz: { rules: ['IsParticipant'] } },
    session: { __authz: { rules: ['Allow'] } },
    sessionLeaderboard: { __authz: { rules: ['IsParticipant'] } },
  },
}
