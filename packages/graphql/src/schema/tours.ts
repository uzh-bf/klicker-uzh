import builder from '../builder.js'
import type { TourState as TourStateType } from '../services/tours.js'

// One GraphQL type serves both actor tables: they differ only in their foreign
// key, which is never exposed because the actor is always the caller.
export interface ITourState extends TourStateType {}

export const TourStateRef = builder.objectRef<ITourState>('TourState')
export const TourState = builder.objectType(TourStateRef, {
  fields: (t) => ({
    id: t.exposeInt('id'),

    tourId: t.exposeString('tourId'),

    completedAt: t.expose('completedAt', { type: 'Date', nullable: true }),
  }),
})
