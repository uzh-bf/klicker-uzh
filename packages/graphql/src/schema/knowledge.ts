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

export const KBSpeedMode = builder.enumType('KBSpeedMode', {
  values: {
    BALANCED: { value: 'balanced' },
    QUALITY: { value: 'quality' },
    FAST: { value: 'fast' },
  } as const,
})

interface IKBResource extends DB.KBResource {
  knowledgeGraph?: {
    chatbot: { id: string; name: string }
  } | null
}

interface IKBResourceKnowledgeGraphAssignment {
  chatbotId: string
  chatbotName: string
}

export const KBResourceKnowledgeGraphAssignmentRef =
  builder.objectRef<IKBResourceKnowledgeGraphAssignment>(
    'KBResourceKnowledgeGraphAssignment'
  )
export const KBResourceKnowledgeGraphAssignment =
  KBResourceKnowledgeGraphAssignmentRef.implement({
    fields: (t) => ({
      chatbotId: t.exposeID('chatbotId'),
      chatbotName: t.exposeString('chatbotName'),
    }),
  })

export const KBResourceRef = builder.objectRef<IKBResource>('KBResource')
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
    knowledgeGraphAssignment: t.field({
      type: KBResourceKnowledgeGraphAssignmentRef,
      nullable: true,
      resolve: (resource) => {
        if (!resource.knowledgeGraph) return null
        return {
          chatbotId: resource.knowledgeGraph.chatbot.id,
          chatbotName: resource.knowledgeGraph.chatbot.name,
        }
      },
    }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})

interface IKB extends DB.KB {
  resources: IKBResource[]
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
