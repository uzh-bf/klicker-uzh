import builder from '../builder.js'
import type { ProductUpdateState as ProductUpdateStateType } from '../services/productUpdates.js'

// One GraphQL type serves both actor tables: they differ only in their foreign
// key, which is never exposed because the actor is always the caller.
export interface IProductUpdateState extends ProductUpdateStateType {}

export const ProductUpdateStateRef =
  builder.objectRef<IProductUpdateState>('ProductUpdateState')
export const ProductUpdateState = builder.objectType(ProductUpdateStateRef, {
  fields: (t) => ({
    id: t.exposeInt('id'),

    updateId: t.exposeString('updateId'),

    firstPresentedAt: t.expose('firstPresentedAt', { type: 'Date' }),
    lastPresentedAt: t.expose('lastPresentedAt', { type: 'Date' }),
    presentationCount: t.exposeInt('presentationCount'),
    readAt: t.expose('readAt', { type: 'Date', nullable: true }),
    dismissedAt: t.expose('dismissedAt', { type: 'Date', nullable: true }),
  }),
})
