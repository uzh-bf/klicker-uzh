import builder from '../builder.js'

export const InvitationStatus = builder.enumType('InvitationStatus', {
  values: ['PENDING', 'ACCEPTED'] as const,
})

export const ParticipantInvitation = builder.prismaObject(
  'ParticipantInvitation',
  {
    fields(t) {
      return {
        id: t.exposeInt('id'),
        email: t.exposeString('email'),
        status: t.expose('status', { type: InvitationStatus }),
        invitedAt: t.expose('invitedAt', { type: 'DateTime' }),
        acceptedAt: t.expose('acceptedAt', {
          type: 'DateTime',
          nullable: true,
        }),

        course: t.relation('course', { nullable: false }),
        participant: t.relation('participant', { nullable: true }),
      }
    },
  }
)

export const InvitationCreationResult = builder.simpleObject(
  'InvitationCreationResult',
  {
    fields(t) {
      return {
        created: t.int(),
        duplicates: t.int(),
        errors: t.stringList(),
      }
    },
  }
)

export const InvitationStatistics = builder.simpleObject(
  'InvitationStatistics',
  {
    fields(t) {
      return {
        total: t.int(),
        pending: t.int(),
        accepted: t.int(),
      }
    },
  }
)
