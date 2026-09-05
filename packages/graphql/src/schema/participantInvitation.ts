import * as DB from '@klicker-uzh/prisma/client'
import builder from '../builder.js'
import type {
  CreateInvitationsResponse,
  InvitationResult,
  ParticipantInvitationPage,
} from '../services/participantInvitations.js'

export const AssessmentParticipantInvitationStatus = builder.enumType(
  'AssessmentParticipantInvitationStatus',
  { values: Object.values(DB.InvitationStatus) }
)

export const AssessmentParticipantInvitationImportStatus = builder.enumType(
  'AssessmentParticipantInvitationImportStatus',
  {
    values: {
      CREATED: { value: 'created' },
      AUTO_ACCEPTED: { value: 'auto_accepted' },
      DUPLICATE: { value: 'duplicate' },
      DUPLICATE_UPDATED: { value: 'duplicate_updated' },
      ERROR: { value: 'error' },
    } as const,
  }
)

export const AssessmentParticipantInvitationInput = builder.inputType(
  'AssessmentParticipantInvitationInput',
  {
    fields: (t) => ({
      email: t.string({ required: true }),
      matriculationNumber: t.string({ required: false }),
    }),
  }
)

export const AssessmentParticipantInvitationRef =
  builder.objectRef<DB.ParticipantInvitation>('AssessmentParticipantInvitation')
export const AssessmentParticipantInvitation =
  AssessmentParticipantInvitationRef.implement({
    fields: (t) => ({
      id: t.exposeInt('id'),
      email: t.exposeString('email'),
      matriculationNumber: t.exposeString('matriculationNumber', {
        nullable: true,
      }),
      status: t.expose('status', {
        type: AssessmentParticipantInvitationStatus,
      }),
      invitedAt: t.expose('invitedAt', { type: 'Date' }),
      acceptedAt: t.expose('acceptedAt', { type: 'Date', nullable: true }),
    }),
  })

export const AssessmentParticipantInvitationPageRef =
  builder.objectRef<ParticipantInvitationPage>(
    'AssessmentParticipantInvitationPage'
  )
export const AssessmentParticipantInvitationPage =
  AssessmentParticipantInvitationPageRef.implement({
    fields: (t) => ({
      invitations: t.expose('invitations', {
        type: [AssessmentParticipantInvitation],
      }),
      totalCount: t.exposeInt('totalCount'),
    }),
  })

export const AssessmentParticipantInvitationImportResultRef =
  builder.objectRef<InvitationResult>(
    'AssessmentParticipantInvitationImportResult'
  )
export const AssessmentParticipantInvitationImportResult =
  AssessmentParticipantInvitationImportResultRef.implement({
    fields: (t) => ({
      email: t.exposeString('email'),
      status: t.expose('status', {
        type: AssessmentParticipantInvitationImportStatus,
      }),
      errorCode: t.exposeString('errorCode', { nullable: true }),
      error: t.exposeString('error', { nullable: true }),
    }),
  })

export const CreateAssessmentParticipantInvitationsPayloadRef =
  builder.objectRef<CreateInvitationsResponse>(
    'CreateAssessmentParticipantInvitationsPayload'
  )
export const CreateAssessmentParticipantInvitationsPayload =
  CreateAssessmentParticipantInvitationsPayloadRef.implement({
    fields: (t) => ({
      totalProcessed: t.exposeInt('totalProcessed'),
      created: t.exposeInt('created'),
      autoAccepted: t.exposeInt('autoAccepted'),
      duplicates: t.exposeInt('duplicates'),
      errors: t.exposeInt('errors'),
      results: t.expose('results', {
        type: [AssessmentParticipantInvitationImportResult],
      }),
    }),
  })
