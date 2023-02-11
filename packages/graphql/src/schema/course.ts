import builder from '../builder'

export const Course = builder.prismaObject('Course', {
  fields: (t) => ({
    id: t.exposeID('id', { nullable: false }),
    name: t.exposeString('name'),
    displayName: t.exposeString('displayName'),

    pinCode: t.exposeInt('pinCode', { nullable: true }),

    color: t.exposeString('color', { nullable: true }),
    description: t.exposeString('description', { nullable: true }),

    isArchived: t.exposeBoolean('isArchived', { nullable: true }),

    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),

    sessions: t.relation('sessions'),
  }),
})

export const LeaderboardEntry = builder.prismaObject('LeaderboardEntry', {
  fields: (t) => ({
    id: t.exposeInt('id'),
  }),
})

interface LeaderboardStatistics {
  participantCount: number
  averageScore: number
}

export const LeaderboardStatistics = builder
  .objectRef<LeaderboardStatistics>('LeaderboardStatistics')
  .implement({
    fields: (t) => ({
      participantCount: t.int({
        nullable: false,
        resolve: (stats) => stats.participantCount,
      }),
      averageScore: t.float({
        nullable: false,
        resolve: (stats) => stats.averageScore,
      }),
    }),
  })

interface GroupLeaderboardEntry {
  id: string
  name: string
  score: number
  rank: number
  isMember?: boolean
}

export const GroupLeaderboardEntry = builder
  .objectRef<GroupLeaderboardEntry>('GroupLeaderboardEntry')
  .implement({
    fields: (t) => ({
      id: t.exposeID('id'),
      name: t.exposeString('name'),
      score: t.exposeFloat('score'),
      rank: t.exposeInt('rank'),
      isMember: t.exposeBoolean('isMember', { nullable: true }),
    }),
  })

export const AwardEntry = builder.prismaObject('AwardEntry', {
  fields: (t) => ({
    id: t.exposeInt('id'),
  }),
})
