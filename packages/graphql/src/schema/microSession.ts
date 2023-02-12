import builder from '../builder'

export const MicroSession = builder.prismaObject('MicroSession', {
  fields: (t) => ({
    id: t.exposeID('id'),

    name: t.exposeString('name'),
    displayName: t.exposeString('displayName'),
    description: t.exposeString('description', { nullable: true }),
    pointsMultiplier: t.exposeFloat('pointsMultiplier'),

    scheduledStartAt: t.expose('scheduledStartAt', { type: 'Date' }),
    scheduledEndAt: t.expose('scheduledEndAt', { type: 'Date' }),

    numOfInstances: t.int({
      resolve: (microSession) => microSession.numOfInstances,
      nullable: true,
    }),

    course: t.relation('course', {}),
    instances: t.relation('instances', {}),
  }),
})
