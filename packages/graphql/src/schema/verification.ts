import * as DB from '@klicker-uzh/prisma/client'
import builder from '../builder.js'
import { checkAccess } from '../services/sharing.js'
import {
  getCourseCredentials,
  getCredentialByToken,
  issueCredential,
  revokeCredential,
} from '../services/verification.js'
import { CourseRef } from './course.js'

export const CredentialType = builder.enumType('CredentialType', {
  values: Object.values(DB.CredentialType),
})

export interface IVerifiableCredential {
  id: string
  token: string
  type: DB.CredentialType
  participantId: string
  courseId: string
  metadata: any
  isRevoked: boolean
  issuedAt: Date
  expiresAt?: Date | null
}

export const VerifiableCredentialRef = builder.objectRef<IVerifiableCredential>(
  'VerifiableCredential'
)

export const VerifiableCredential = builder.objectType(
  VerifiableCredentialRef,
  {
    fields: (t) => ({
      id: t.exposeID('id'),
      token: t.exposeString('token'),
      type: t.expose('type', { type: CredentialType }),
      metadata: t.expose('metadata', { type: 'Json' }),
      isRevoked: t.exposeBoolean('isRevoked'),
      issuedAt: t.expose('issuedAt', { type: 'Date' }),
      expiresAt: t.expose('expiresAt', { type: 'Date', nullable: true }),
      course: t.field({
        type: CourseRef,
        resolve: async (parent, _, ctx) => {
          return await ctx.prisma.course.findUniqueOrThrow({
            where: { id: parent.courseId },
          })
        },
      }),
    }),
  }
)

builder.queryFields((t) => ({
  verifiableCredential: t.field({
    type: VerifiableCredentialRef,
    nullable: true,
    args: {
      token: t.arg.string({ required: true }),
    },
    resolve: async (_, { token }, ctx) => {
      return await getCredentialByToken({ token, prisma: ctx.prisma })
    },
  }),
  courseVerificationRecords: t.field({
    type: [VerifiableCredentialRef],
    args: {
      courseId: t.arg.string({ required: true }),
    },
    resolve: async (_, { courseId }, ctx) => {
      if (!ctx.user) {
        throw new Error('Not authenticated')
      }
      const hasWriteAccess = await checkAccess(
        [{ courseId, minimumPermissionLevel: DB.PermissionLevel.WRITE }],
        ctx as any
      )
      if (!hasWriteAccess) {
        throw new Error('Not authorized')
      }
      return await getCourseCredentials({ courseId, prisma: ctx.prisma })
    },
  }),
}))

builder.mutationFields((t) => ({
  issueCredential: t.field({
    type: VerifiableCredentialRef,
    args: {
      courseId: t.arg.string({ required: true }),
      type: t.arg({ type: CredentialType, required: true }),
      metadata: t.arg({ type: 'Json', required: true }),
    },
    resolve: async (_, { courseId, type, metadata }, ctx) => {
      if (!ctx.user) {
        throw new Error('Not authenticated')
      }
      const participantId = ctx.user.sub
      return await issueCredential({
        participantId,
        courseId,
        type,
        metadata,
        prisma: ctx.prisma,
      })
    },
  }),
  revokeCredential: t.field({
    type: VerifiableCredentialRef,
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_, { id }, ctx) => {
      if (!ctx.user) {
        throw new Error('Not authenticated')
      }
      const record = await ctx.prisma.verifiableCredential.findUnique({
        where: { id },
      })
      if (!record) {
        throw new Error('Credential not found')
      }
      const hasWriteAccess = await checkAccess(
        [
          {
            courseId: record.courseId,
            minimumPermissionLevel: DB.PermissionLevel.WRITE,
          },
        ],
        ctx as any
      )
      if (!hasWriteAccess) {
        throw new Error('Not authorized')
      }
      return await revokeCredential({ id, prisma: ctx.prisma })
    },
  }),
}))
