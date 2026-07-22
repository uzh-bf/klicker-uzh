import * as DB from '@klicker-uzh/prisma/client'
import builder from '../builder.js'
import * as ElementService from '../services/elements.js'

export interface IFileUploadSAS {
  mediaFileId: string
  uploadSasURL: string
  uploadHref: string
  containerName: string
  fileName: string
}

export const FileUploadSASRef =
  builder.objectRef<IFileUploadSAS>('FileUploadSAS')
export const FileUploadSAS = FileUploadSASRef.implement({
  fields: (t) => ({
    mediaFileId: t.exposeID('mediaFileId'),
    uploadSasURL: t.exposeString('uploadSasURL'),
    uploadHref: t.exposeString('uploadHref'),
    containerName: t.exposeString('containerName'),
    fileName: t.exposeString('fileName'),
  }),
})

const asUserFullAccess = {
  authenticated: true,
  role: DB.UserRole.USER,
  scope: DB.UserLoginScope.FULL_ACCESS,
}

builder.mutationFields((t) => ({
  getFileUploadSas: t.withAuth(asUserFullAccess).field({
    nullable: true,
    type: FileUploadSAS,
    args: {
      fileName: t.arg.string({ required: true }),
      contentType: t.arg.string({ required: true }),
      requiresFinalization: t.arg.boolean({
        required: false,
        defaultValue: false,
      }),
    },
    resolve: async (_, args, ctx) => {
      return await ElementService.getFileUploadSas(args, ctx)
    },
  }),

  finalizeFileUpload: t.withAuth(asUserFullAccess).boolean({
    nullable: false,
    args: {
      mediaFileId: t.arg.id({ required: true }),
    },
    resolve: async (_, args, ctx) => {
      return await ElementService.finalizeFileUpload(args, ctx)
    },
  }),
}))
