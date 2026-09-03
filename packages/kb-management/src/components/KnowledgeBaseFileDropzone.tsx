import { useMutation } from '@apollo/client'
import {
  ConfirmKbFileReplacementDocument,
  ConfirmKbFileUploadDocument,
  KbResourceMaterialType,
  RequestKbFileReplacementDocument,
  RequestKbFileUploadDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H3, SelectField, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useEffect, useState } from 'react'
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
  embedded = false,
  replaceResource,
  onUploadStateChange,
  onResourceCreated,
}: {
  kbId: string
  embedded?: boolean
  replaceResource?: { id: string; title: string }
  onUploadStateChange?: (uploading: boolean) => void
  onResourceCreated: () => Promise<unknown>
}) {
  const t = useTranslations()
  const [uploading, setUploading] = useState(false)
  const [replacementFile, setReplacementFile] = useState<File | null>(null)
  const [materialType, setMaterialType] = useState(
    KbResourceMaterialType.CourseContent
  )
  const [requestUpload] = useMutation(RequestKbFileUploadDocument)
  const [confirmUpload] = useMutation(ConfirmKbFileUploadDocument)
  const [requestReplacement] = useMutation(RequestKbFileReplacementDocument)
  const [confirmReplacement] = useMutation(ConfirmKbFileReplacementDocument)

  useEffect(() => {
    onUploadStateChange?.(uploading)
  }, [onUploadStateChange, uploading])

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
        const requestVariables = {
          kbId,
          fileName: file.name,
          contentType,
          sizeBytes: file.size,
        }
        const ticket = replaceResource
          ? (
              await requestReplacement({
                variables: {
                  ...requestVariables,
                  resourceId: replaceResource.id,
                },
              })
            ).data?.requestKbFileReplacement
          : (await requestUpload({ variables: requestVariables })).data
              ?.requestKbFileUpload
        if (!ticket) throw new Error('Upload ticket was not returned')

        const { BlobServiceClient } = await import('@azure/storage-blob')
        const serviceClient = new BlobServiceClient(ticket.uploadSasURL)
        const blockBlobClient = serviceClient
          .getContainerClient(ticket.containerName)
          .getBlockBlobClient(ticket.blobName)
        await blockBlobClient.uploadData(file, {
          blobHTTPHeaders: { blobContentType: contentType },
        })

        if (replaceResource) {
          await confirmReplacement({
            variables: {
              kbId,
              resourceId: replaceResource.id,
              blobName: ticket.blobName,
              originalFilename: file.name,
              mimeType: contentType,
              sizeBytes: file.size,
            },
          })
        } else {
          await confirmUpload({
            variables: {
              kbId,
              blobName: ticket.blobName,
              title: file.name,
              originalFilename: file.name,
              mimeType: contentType,
              sizeBytes: file.size,
              materialType,
            },
          })
        }
      } catch (error) {
        console.error('Failed to upload KB file', error)
        const code = getGraphQLErrorCode(error)
        if (replaceResource && code === 'KB_INGESTION_QUEUE_FAILED') {
          await refreshAfterMutation(
            onResourceCreated,
            'KB resources after replacement queue failure'
          )
          setReplacementFile(null)
        }
        const message =
          code === 'KB_RESOURCE_LIMIT_REACHED'
            ? t('kb.resourceLimitError')
            : code === 'KB_STORAGE_LIMIT_REACHED'
              ? t('kb.storageLimitError')
              : code === 'KB_UPLOAD_TICKET_MISMATCH'
                ? t('kb.uploadMismatchError')
                : code === 'KB_INGESTION_QUEUE_FAILED'
                  ? t('kb.ingestResourceError')
                  : code === 'KB_INGESTION_DISABLED'
                    ? t('kb.ingestionDisabledError')
                    : t('kb.fileUploadError')
        toast({ type: 'error', message })
        return
      }

      await refreshAfterMutation(onResourceCreated, 'KB resources after upload')
      if (!replaceResource) {
        setMaterialType(KbResourceMaterialType.CourseContent)
      } else {
        setReplacementFile(null)
      }
      toast({
        type: 'success',
        message: replaceResource
          ? t('kb.replaceFileSuccess')
          : t('kb.fileUploadSuccess'),
      })
    } finally {
      setUploading(false)
    }
  }

  const { getInputProps, getRootProps, isDragActive } = useDropzone({
    accept: ACCEPTED_FILES,
    disabled: uploading,
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    onDropAccepted: (files) => {
      if (replaceResource) {
        setReplacementFile(files[0] ?? null)
        return
      }
      void uploadFile(files)
    },
    onDropRejected: () =>
      toast({ type: 'error', message: t('kb.fileRejected') }),
  })

  const content = (
    <>
      {!embedded ? <H3>{t('kb.fileUploadTitle')}</H3> : null}
      {replaceResource ? (
        <p className="mt-1 text-sm text-slate-600">
          {t('kb.replaceFileDescription', { title: replaceResource.title })}
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-slate-600">
            {t('kb.fileUploadDescription')}
          </p>
          <SelectField
            id="kb-file-material-type"
            label={t('kb.materialType')}
            value={materialType}
            onChange={(value) =>
              setMaterialType(value as KbResourceMaterialType)
            }
            items={[
              {
                value: KbResourceMaterialType.Unclassified,
                label: t('kb.materialTypeUnclassified'),
              },
              {
                value: KbResourceMaterialType.CourseContent,
                label: t('kb.materialTypeCourseContent'),
              },
              {
                value: KbResourceMaterialType.Administrative,
                label: t('kb.materialTypeAdministrative'),
              },
            ]}
            disabled={uploading}
            data={{ cy: 'kb-file-material-type' }}
          />
        </>
      )}
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
          {uploading
            ? t('kb.uploading')
            : (replacementFile?.name ?? t('kb.fileDropPrompt'))}
        </span>
        <span className="mt-1 text-xs text-slate-500">
          {t('kb.fileUploadFormats')}
        </span>
      </div>
      {replaceResource && replacementFile ? (
        <Button
          onClick={() => void uploadFile([replacementFile])}
          disabled={uploading}
          data={{ cy: 'confirm-kb-file-replacement' }}
          className={{ root: 'mt-4 w-full justify-center' }}
        >
          <Button.Label>{t('kb.replaceAndIngest')}</Button.Label>
        </Button>
      ) : null}
    </>
  )

  return embedded ? (
    <div data-cy="kb-file-upload-form">{content}</div>
  ) : (
    <section
      id="kb-file-upload"
      tabIndex={-1}
      className="scroll-mt-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm"
    >
      {content}
    </section>
  )
}

export default KnowledgeBaseFileDropzone
