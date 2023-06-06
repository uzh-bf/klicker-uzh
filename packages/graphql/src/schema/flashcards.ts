import * as DB from '@klicker-uzh/prisma'

import builder from '../builder'
import { Course } from './course'

export const FlashcardSetStatus = builder.enumType('FlashcardSetStatus', {
  values: Object.values(DB.FlashcardSetStatus),
})

export interface IFlashcardSet extends DB.FlashcardSet {
  flashcards?: DB.Flashcard[]
  course?: DB.Course
}
export const FlashcardSetRef = builder.objectRef<IFlashcardSet>('FlashcardSet')
export const FlashcardSet = FlashcardSetRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),

    name: t.exposeString('name'),
    displayName: t.exposeString('displayName'),
    description: t.exposeString('description', { nullable: true }),

    status: t.expose('status', { type: FlashcardSetStatus }),

    flashcards: t.expose('flashcards', {
      type: [Flashcard],
      nullable: true,
    }),

    course: t.expose('course', {
      type: Course,
      nullable: true,
    }),

    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date', nullable: true }),
  }),
})

export interface IFlashcard extends DB.Flashcard {}
export const FlashcardRef = builder.objectRef<IFlashcard>('Flashcard')
export const Flashcard = FlashcardRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),

    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date', nullable: true }),
  }),
})
