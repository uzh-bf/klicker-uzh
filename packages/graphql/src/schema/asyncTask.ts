import * as DB from '@klicker-uzh/prisma/client'
import builder from '../builder.js'

export const AsyncTaskKind = builder.enumType('AsyncTaskKind', {
  values: Object.values(DB.AsyncTaskKind),
})

export const AsyncTaskStatus = builder.enumType('AsyncTaskStatus', {
  values: Object.values(DB.AsyncTaskStatus),
})

export const AsyncTaskRef = builder.objectRef<DB.AsyncTask>('AsyncTask')

export const AsyncTask = builder.objectType(AsyncTaskRef, {
  fields: (t) => ({
    id: t.exposeID('id'),
    kind: t.expose('kind', { type: AsyncTaskKind }),
    status: t.expose('status', { type: AsyncTaskStatus }),
    subjectId: t.exposeString('subjectId', { nullable: true }),
    subjectName: t.exposeString('subjectName'),
    targetName: t.exposeString('targetName', { nullable: true }),
    resultId: t.exposeString('resultId', { nullable: true }),
    errorCode: t.exposeString('errorCode', { nullable: true }),
    startedAt: t.expose('startedAt', { type: 'Date', nullable: true }),
    finishedAt: t.expose('finishedAt', { type: 'Date', nullable: true }),
    readAt: t.expose('readAt', { type: 'Date', nullable: true }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})
