import { useMutation } from '@apollo/client'
import {
  ConfirmKbFileUploadDocument,
  RequestKbFileUploadDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { H3, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { getGraphQLErrorCode } from '../graphqlError'
import { refreshAfterMutation } from '../refreshAfterMutation'

const MAX_FILE_SIZE = 25 * 1024 * 1024
const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/plain',
}

const ACCEPTED_FILES = {
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt', '.md'],
}

function KnowledgeBaseFileDropzone({
  kbId,
  onResourceCreated,
}: {
  kbId: string
  onResourceCreated: () => Promise<unknown>
}) {
  const t = useTranslations()
  const [uploading, setUploading] = useState(false)
  const [requestUpload] = useMutation(RequestKbFileUploadDocument)
  const [confirmUpload] = useMutation(ConfirmKbFileUploadDocument)

  const uploadFile = async (files: File[]) => {
    const file = files[0]
    if (!file || uploading) return

    const extension = file.name.split('.').pop()?.toLowerCase()
    const contentType = extension ? CONTENT_TYPES[extension] : undefined
    if (!contentType) {
      toast({ type: 'error', message: t('kb.fileRejected') })
      return
    }

    setUploading(true)
    try {
      try {
        const { data } = await requestUpload({
          variables: {
            kbId,
            fileName: file.name,
            contentType,
            sizeBytes: file.size,
          },
        })
        const ticket = data?.requestKbFileUpload
        if (!ticket) throw new Error('Upload ticket was not returned')

        const { BlobServiceClient } = await import('@azure/storage-blob')
        const serviceClient = new BlobServiceClient(ticket.uploadSasURL)
        const blockBlobClient = serviceClient
          .getContainerClient(ticket.containerName)
          .getBlockBlobClient(ticket.blobName)
        await blockBlobClient.uploadData(file, {
          blobHTTPHeaders: { blobContentType: contentType },
        })

        await confirmUpload({
          variables: {
            kbId,
            blobName: ticket.blobName,
            title: file.name,
            originalFilename: file.name,
            mimeType: contentType,
            sizeBytes: file.size,
          },
        })
      } catch (error) {
        console.error('Failed to upload KB file', error)
        const code = getGraphQLErrorCode(error)
        const message =
          code === 'KB_RESOURCE_LIMIT_REACHED'
            ? t('kb.resourceLimitError')
            : code === 'KB_STORAGE_LIMIT_REACHED'
              ? t('kb.storageLimitError')
              : code === 'KB_UPLOAD_TICKET_MISMATCH'
                ? t('kb.uploadMismatchError')
                : code === 'KB_INGESTION_DISABLED'
                  ? t('kb.ingestionDisabledError')
                  : t('kb.fileUploadError')
        toast({ type: 'error', message })
        return
      }

      await refreshAfterMutation(onResourceCreated, 'KB resources after upload')
      toast({ type: 'success', message: t('kb.fileUploadSuccess') })
    } finally {
      setUploading(false)
    }
  }

  const { getInputProps, getRootProps, isDragActive } = useDropzone({
    accept: ACCEPTED_FILES,
    disabled: uploading,
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    onDropAccepted: uploadFile,
    onDropRejected: () =>
      toast({ type: 'error', message: t('kb.fileRejected') }),
  })

  return (
    <section
      id="kb-file-upload"
      tabIndex={-1}
      className="scroll-mt-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm"
    >
      <H3>{t('kb.fileUploadTitle')}</H3>
      <p className="mt-1 text-sm text-slate-600">
        {t('kb.fileUploadDescription')}
      </p>
      <div
        {...getRootProps({
          role: 'button',
          'aria-label': t('kb.fileDropPrompt'),
          'aria-busy': uploading,
          'data-cy': 'kb-file-dropzone',
          className: `mt-4 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-4 py-6 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-100 ${
            isDragActive
              ? 'border-primary-100 bg-uzh-blue-20'
              : 'border-slate-300 hover:bg-slate-50'
          } ${uploading ? 'cursor-wait opacity-70' : ''}`,
        })}
      >
        <input {...getInputProps()} data-cy="kb-file-input" />
        <span className="font-medium" aria-live="polite">
          {uploading ? t('kb.uploading') : t('kb.fileDropPrompt')}
        </span>
        <span className="mt-1 text-xs text-slate-500">
          {t('kb.fileUploadFormats')}
        </span>
      </div>
    </section>
  )
}

export default KnowledgeBaseFileDropzone
