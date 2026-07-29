import * as DB from '@klicker-uzh/prisma/client'
import builder from '../builder.js'

export const EscapeRoomConfigRef =
  builder.objectRef<DB.EscapeRoomConfig>('EscapeRoomConfig')

export const EscapeRoomConfig = EscapeRoomConfigRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),
    timeLimit: t.exposeInt('timeLimit'),
    hintPenalty: t.exposeInt('hintPenalty'),
    lockoutSeconds: t.exposeInt('lockoutSeconds'),
    introText: t.exposeString('introText', { nullable: true }),

    practiceQuizId: t.exposeString('practiceQuizId', { nullable: true }),
    microLearningId: t.exposeString('microLearningId', { nullable: true }),
    groupActivityId: t.exposeString('groupActivityId', { nullable: true }),
  }),
})

export interface IEscapeRoomHint {
  instanceId: number
  hint: string
}

export const EscapeRoomHintRef =
  builder.objectRef<IEscapeRoomHint>('EscapeRoomHint')
export const EscapeRoomHint = EscapeRoomHintRef.implement({
  fields: (t) => ({
    instanceId: t.exposeInt('instanceId'),
    hint: t.exposeString('hint'),
  }),
})
