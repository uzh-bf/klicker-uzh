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
    hintPenalties: t.exposeIntList('hintPenalties'),
    wrongAnswerPenalty: t.exposeInt('wrongAnswerPenalty'),
    maxWrongAttempts: t.exposeInt('maxWrongAttempts', { nullable: true }),
    revealPenalty: t.exposeInt('revealPenalty'),
    skipPenalty: t.exposeInt('skipPenalty', { nullable: true }),
    bonusSeconds: t.exposeInt('bonusSeconds', { nullable: true }),

    practiceQuizId: t.exposeString('practiceQuizId', { nullable: true }),
    microLearningId: t.exposeString('microLearningId', { nullable: true }),
    groupActivityId: t.exposeString('groupActivityId', { nullable: true }),
    elementBlockId: t.exposeInt('elementBlockId', { nullable: true }),
  }),
})

export interface IEscapeRoomHintEntry {
  text: string
  penalty?: number | null
}

export const EscapeRoomHintEntryRef = builder.objectRef<IEscapeRoomHintEntry>(
  'EscapeRoomHintEntry'
)
export const EscapeRoomHintEntry = EscapeRoomHintEntryRef.implement({
  fields: (t) => ({
    text: t.exposeString('text'),
    penalty: t.exposeInt('penalty', { nullable: true }),
  }),
})

export const EscapeRoomHintEntryInputRef = builder.inputRef<{
  text: string
  penalty?: number | null
}>('EscapeRoomHintEntryInput')
export const EscapeRoomHintEntryInput = EscapeRoomHintEntryInputRef.implement({
  fields: (t) => ({
    text: t.string({ required: true }),
    penalty: t.int({ required: false }),
  }),
})

export interface IEscapeRoomRulesInput {
  hintPenalties?: number[] | null
  wrongAnswerPenalty?: number | null
  maxWrongAttempts?: number | null
  revealPenalty?: number | null
  skipPenalty?: number | null
  bonusSeconds?: number | null
}

export const EscapeRoomRulesInputRef = builder.inputRef<IEscapeRoomRulesInput>(
  'EscapeRoomRulesInput'
)
export const EscapeRoomRulesInput = EscapeRoomRulesInputRef.implement({
  fields: (t) => ({
    hintPenalties: t.intList({ required: false }),
    wrongAnswerPenalty: t.int({ required: false }),
    maxWrongAttempts: t.int({ required: false }),
    revealPenalty: t.int({ required: false }),
    skipPenalty: t.int({ required: false }),
    bonusSeconds: t.int({ required: false }),
  }),
})

export interface IEscapeRoomHint {
  instanceId: number
  hint: string
  debrief?: string | null
  hints: IEscapeRoomHintEntry[]
}

export const EscapeRoomHintRef =
  builder.objectRef<IEscapeRoomHint>('EscapeRoomHint')
export const EscapeRoomHint = EscapeRoomHintRef.implement({
  fields: (t) => ({
    instanceId: t.exposeInt('instanceId'),
    hint: t.exposeString('hint'),
    debrief: t.exposeString('debrief', { nullable: true }),
    hints: t.field({
      type: [EscapeRoomHintEntryRef],
      resolve: (parent) => parent.hints,
    }),
  }),
})
