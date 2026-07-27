import * as DB from '@klicker-uzh/prisma/client'
import builder from '../builder.js'

interface IKBFileUpload {
  uploadSasURL: string
  containerName: string
  blobName: string
}

export const KBFileUploadRef = builder.objectRef<IKBFileUpload>('KBFileUpload')
export const KBFileUpload = KBFileUploadRef.implement({
  fields: (t) => ({
    uploadSasURL: t.exposeString('uploadSasURL'),
    containerName: t.exposeString('containerName'),
    blobName: t.exposeString('blobName'),
  }),
})

export const KBResourceType = builder.enumType('KBResourceType', {
  values: Object.values(DB.KBResourceType),
})

export const KBResourceStatus = builder.enumType('KBResourceStatus', {
  values: Object.values(DB.KBResourceStatus),
})

export const KBIngestionStatus = builder.enumType('KBIngestionStatus', {
  values: Object.values(DB.KBIngestionStatus),
})

export const KBIngestionRunRef =
  builder.objectRef<DB.KBIngestionRun>('KBIngestionRun')
export const KBIngestionRun = KBIngestionRunRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    status: t.expose('status', { type: KBIngestionStatus }),
    resourceVersion: t.exposeInt('resourceVersion'),
    contentSha256: t.exposeString('contentSha256', { nullable: true }),
    statusMessage: t.exposeString('statusMessage', { nullable: true }),
    errorCode: t.exposeString('errorCode', { nullable: true }),
    startedAt: t.expose('startedAt', { type: 'Date', nullable: true }),
    finishedAt: t.expose('finishedAt', { type: 'Date', nullable: true }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})

export const KBResourceRef = builder.objectRef<DB.KBResource>('KBResource')
export const KBResource = KBResourceRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    type: t.expose('type', { type: KBResourceType }),
    title: t.exposeString('title'),
    sourceUrl: t.exposeString('sourceUrl', { nullable: true }),
    originalFilename: t.exposeString('originalFilename', { nullable: true }),
    mimeType: t.exposeString('mimeType', { nullable: true }),
    sizeBytes: t.exposeInt('sizeBytes', { nullable: true }),
    status: t.expose('status', { type: KBResourceStatus }),
    statusMessage: t.exposeString('statusMessage', { nullable: true }),
    ingestedAt: t.expose('ingestedAt', { type: 'Date', nullable: true }),
    resourceVersion: t.exposeInt('resourceVersion'),
    activeResourceVersion: t.exposeInt('activeResourceVersion', {
      nullable: true,
    }),
    activeContentSha256: t.exposeString('activeContentSha256', {
      nullable: true,
    }),
    errorCode: t.exposeString('errorCode', { nullable: true }),
    ingestionRuns: t.field({
      type: [KBIngestionRunRef],
      resolve: async (resource, _, ctx) =>
        ctx.prisma.kBIngestionRun.findMany({
          where: { resourceId: resource.id },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
    }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})

interface IKB extends DB.KB {
  resources: DB.KBResource[]
}

export const KBRef = builder.objectRef<IKB>('KB')
export const KB = KBRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    description: t.exposeString('description', { nullable: true }),
    resources: t.expose('resources', { type: [KBResourceRef] }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})
