import * as DB from '@klicker-uzh/prisma'

import builder from '../builder'

export const LearningElementOrderType = builder.enumType(
  'LearningElementOrderType',
  {
    values: Object.values(DB.OrderType),
  }
)

export const LearningElement = builder.prismaObject('LearningElement', {
  fields: (t) => ({
    id: t.exposeID('id'),

    name: t.exposeString('name'),
    displayName: t.exposeString('displayName'),
    description: t.exposeString('description', { nullable: true }),
    pointsMultiplier: t.exposeInt('pointsMultiplier'),
    resetTimeDays: t.exposeInt('resetTimeDays'),
    orderType: t.expose('orderType', { type: LearningElementOrderType }),

    previouslyAnswered: t.int({
      resolve: (elem) => elem.previouslyAnswered,
    }),

    previousScore: t.float({
      resolve: (elem) => elem.previousScore,
    }),

    previousPointsAwarded: t.float({
      resolve: (elem) => elem.previousPointsAwarded,
    }),

    totalTrials: t.int({
      resolve: (elem) => elem.totalTrials,
    }),

    instances: t.relation('instances', {}),
    numOfInstances: t.int({
      resolve: (elem) => elem.numOfInstances,
    }),

    course: t.relation('course', {}),
    courseId: t.string({
      resolve: (elem) => elem.courseId,
    }),
  }),
})
