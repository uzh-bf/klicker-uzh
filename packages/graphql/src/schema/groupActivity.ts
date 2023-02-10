import builder from '../builder'

export const GroupActivityDecisionInput = builder.inputType(
  'GroupActivityDecisionInput',
  {
    fields: (t) => ({
      id: t.int({ required: true }),

      selectedOptions: t.intList({ required: true }),
      response: t.string({ required: false }),
    }),
  }
)

export const GroupActivity = builder.prismaObject('GroupActivity', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
})

export const GroupActivityInstance = builder.prismaObject(
  'GroupActivityInstance',
  {
    fields: (t) => ({
      id: t.exposeInt('id'),
    }),
  }
)

export const GroupActivityClue = builder.prismaObject('GroupActivityClue', {
  fields: (t) => ({
    id: t.exposeInt('id'),
  }),
})

export const GroupActivityClueInstance = builder.prismaObject(
  'GroupActivityClueInstance',
  {
    fields: (t) => ({
      id: t.exposeInt('id'),
    }),
  }
)

export const GroupActivityClueAssignment = builder.prismaObject(
  'GroupActivityClueAssignment',
  {
    fields: (t) => ({
      id: t.exposeInt('id'),
    }),
  }
)

export const GroupActivityParameter = builder.prismaObject(
  'GroupActivityParameter',
  {
    fields: (t) => ({
      id: t.exposeInt('id'),
    }),
  }
)

// interface GroupActivityDetails {
//   id: string
//   name: string
//   displayName: string
//   description?: string
//   scheduledStartAt?: Date
//   scheduledEndAt?: Date
//   group: any
//   course: any
//   activityInstance: any
//   clues: any
//   instances: any
// }

// export const GroupActivityDetails = builder
//   .objectRef<GroupActivityDetails>('GroupActivityDetails')
//   .implement({
//     fields: (t) => ({
//       id: t.exposeString('id'),

//       name: t.exposeString('name', { nullable: false }),
//       displayName: t.exposeString('displayName', { nullable: false }),
//       description: t.exposeString('description', { nullable: true }),

//       scheduledStartAt: t.expose('scheduledStartAt', { type: 'Date' }),
//       scheduledEndAt: t.expose('scheduledEndAt', { type: 'Date' }),

//       activityInstance: t.field({
//         type: GroupActivityInstance,
//         resolve: (root, args, ctx) => {
//           return root.activityInstance
//         },
//       }),

//       // group: t.relation('group'),
//       // course: t.relation('course'),
//       // clues: t.relation('clues'),
//       // instances: t.relation('instances'),
//     }),
//   })
