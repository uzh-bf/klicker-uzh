import { or, preExecRule } from '@graphql-authz/core'
import { UserRole } from '@klicker-uzh/prisma'

const Reject = preExecRule()(() => {
  return false
})

const Allow = preExecRule()(() => {
  return true
})

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
  Reject,
  Allow,
  IsAuthenticated,
  IsParticipant,
  IsUser,
  IsAdmin,
  IsUserOrAdmin,
}

export const AuthSchema = {
  Mutation: {
    '*': { __authz: { rules: ['Allow'] } },
    addConfusionTimestep: { __authz: { rules: ['Allow'] } },
    changeSessionSettings: { __authz: { rules: ['IsUserOrAdmin'] } },
    deleteFeedback: { __authz: { rules: ['IsUserOrAdmin'] } },
    deleteFeedbackResponse: { __authz: { rules: ['IsUserOrAdmin'] } },
    deleteQuestion: { __authz: { rules: ['IsUserOrAdmin'] } },
    endSession: { __authz: { rules: ['IsUserOrAdmin'] } },
    loginUser: { __authz: { rules: ['Allow'] } },
    loginParticipant: { __authz: { rules: ['Allow'] } },
    logoutUser: { __authz: { rules: ['IsUserOrAdmin'] } },
    logoutParticipant: { __authz: { rules: ['IsParticipant'] } },
    manipulateQuestion: { __authz: { rules: ['IsUserOrAdmin'] } },
    pinFeedback: { __authz: { rules: ['IsUserOrAdmin'] } },
    publishFeedback: { __authz: { rules: ['IsUserOrAdmin'] } },
    registerParticipantFromLTI: { __authz: { rules: ['IsAdmin'] } },
    createCourse: { __authz: { rules: ['IsUserOrAdmin'] } },
    createParticipantGroup: { __authz: { rules: ['IsParticipant'] } },
    createSession: { __authz: { rules: ['IsUserOrAdmin'] } },
    createParticipantAndJoinCourse: { __authz: { rules: ['Allow'] } },
    joinCourse: { __authz: { rules: ['IsParticipant'] } },
    leaveCourse: { __authz: { rules: ['IsParticipant'] } },
    leaveParticipantGroup: { __authz: { rules: ['IsParticipant'] } },
    joinParticipantGroup: { __authz: { rules: ['IsParticipant'] } },
    updateParticipantProfile: { __authz: { rules: ['IsParticipant'] } },
    subscribeToPush: { __authz: { rules: ['IsParticipant'] } },
    resolveFeedback: { __authz: { rules: ['IsUserOrAdmin'] } },
    respondToFeedback: { __authz: { rules: ['IsUserOrAdmin'] } },
    startSession: { __authz: { rules: ['IsUserOrAdmin'] } },
  },

  Query: {
    '*': { __authz: { rules: ['Allow'] } },
    basicCourseInformation: { __authz: { rules: ['Allow'] } },
    cockpitSession: { __authz: { rules: ['IsUserOrAdmin'] } },
    learningElement: { __authz: { rules: ['Allow'] } },
    feedbacks: { __authz: { rules: ['Allow'] } },
    getCourseOverviewData: { __authz: { rules: ['Allow'] } },
    participations: { __authz: { rules: ['IsParticipant'] } },
    participantGroups: { __authz: { rules: ['IsParticipant'] } },
    pinnedFeedbacks: { __authz: { rules: ['IsUserOrAdmin'] } },
    question: { __authz: { rules: ['IsUserOrAdmin'] } },
    self: { __authz: { rules: ['IsParticipant'] } },
    // TODO: should session be restricted to users only?
    session: { __authz: { rules: ['Allow'] } },
    sessionEvaluation: { __authz: { rules: ['IsUserOrAdmin'] } },
    sessionLeaderboard: { __authz: { rules: ['IsParticipant'] } },
    userProfile: { __authz: { rules: ['IsUserOrAdmin'] } },
    userQuestions: { __authz: { rules: ['IsUserOrAdmin'] } },
    userSessions: { __authz: { rules: ['IsUserOrAdmin'] } },
    microSession: { __authz: { rules: ['Allow'] } },
  },
}
