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
  onUploadFinished,
}: {
  kbId: string
  embedded?: boolean
  replaceResource?: { id: string; title: string }
  onUploadStateChange?: (uploading: boolean) => void
  onResourceCreated: () => Promise<unknown>
  onUploadFinished?: (outcome: { succeeded: number; failed: number }) => void
}) {
  const t = useTranslations()
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<{
    current: number
    total: number
  } | null>(null)
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

  // Each file is transferred on its own so that one rejected or failed file
  // leaves the others in the batch intact. Returns the message to report when
  // this file did not reach the knowledge base.
  const transferFile = async (file: File): Promise<string | null> => {
    const extension = file.name.split('.').pop()?.toLowerCase()
    const contentType = extension ? CONTENT_TYPES[extension] : undefined
    if (!contentType) {
      return t('kb.fileRejected')
    }

    try {
      const requestVariables = {
        kbId,
        fileName: file.name,
        contentType,
        sizeBytes: file.size,
      }
      const uploadReservation = replaceResource
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
      if (!uploadReservation)
        throw new Error('Upload reservation was not returned')

      const { BlobServiceClient } = await import('@azure/storage-blob')
      const serviceClient = new BlobServiceClient(
        uploadReservation.uploadSasURL
      )
      const blockBlobClient = serviceClient
        .getContainerClient(uploadReservation.containerName)
        .getBlockBlobClient(uploadReservation.blobName)
      await blockBlobClient.uploadData(file, {
        blobHTTPHeaders: { blobContentType: contentType },
      })

      if (replaceResource) {
        await confirmReplacement({
          variables: {
            kbId,
            resourceId: replaceResource.id,
            blobName: uploadReservation.blobName,
            originalFilename: file.name,
            mimeType: contentType,
            sizeBytes: file.size,
          },
        })
      } else {
        await confirmUpload({
          variables: {
            kbId,
            blobName: uploadReservation.blobName,
            title: file.name,
            originalFilename: file.name,
            mimeType: contentType,
            sizeBytes: file.size,
            materialType,
          },
        })
      }
      return null
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
      switch (code) {
        case 'KB_RESOURCE_LIMIT_REACHED':
          return t('kb.resourceLimitError')
        case 'KB_STORAGE_LIMIT_REACHED':
          return t('kb.storageLimitError')
        case 'KB_UPLOAD_TICKET_MISMATCH':
          return t('kb.uploadMismatchError')
        case 'KB_INGESTION_QUEUE_FAILED':
          return t('kb.ingestResourceError')
        case 'KB_INGESTION_DISABLED':
          return t('kb.ingestionDisabledError')
        default:
          return t('kb.fileUploadError')
      }
    }
  }

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0 || uploading) return

    setUploading(true)
    const failed: { name: string; reason: string }[] = []
    let succeeded = 0
    try {
      for (const [index, file] of files.entries()) {
        setProgress({ current: index + 1, total: files.length })
        const failure = await transferFile(file)
        if (failure === null) {
          succeeded += 1
        } else {
          failed.push({ name: file.name, reason: failure })
          // A single file keeps its precise reason; a batch reports the names
          // once the whole transfer is done.
          if (files.length === 1) {
            toast({ type: 'error', message: failure })
          }
        }
      }

      if (succeeded > 0) {
        await refreshAfterMutation(
          onResourceCreated,
          'KB resources after upload'
        )
        if (!replaceResource) {
          setMaterialType(KbResourceMaterialType.CourseContent)
        } else {
          setReplacementFile(null)
        }
      }

      if (failed.length > 0 && files.length > 1) {
        toast({
          type: 'error',
          message: t('kb.fileUploadBatchPartial', {
            succeeded,
            total: files.length,
            files: failed.map(({ name }) => name).join(', '),
            // Files that failed for the same reason report it once.
            reason: [...new Set(failed.map(({ reason }) => reason))].join(' '),
          }),
        })
      } else if (failed.length === 0) {
        toast({
          type: 'success',
          message: replaceResource
            ? t('kb.replaceFileSuccess')
            : files.length > 1
              ? t('kb.fileUploadBatchSuccess', { count: files.length })
              : t('kb.fileUploadSuccess'),
        })
      }
    } finally {
      setProgress(null)
      setUploading(false)
      onUploadFinished?.({ succeeded, failed: failed.length })
    }
  }

  const { getInputProps, getRootProps, isDragActive } = useDropzone({
    accept: ACCEPTED_FILES,
    disabled: uploading,
    maxSize: MAX_FILE_SIZE,
    multiple: !replaceResource,
    onDropAccepted: (files) => {
      if (replaceResource) {
        setReplacementFile(files[0] ?? null)
        return
      }
      void uploadFiles(files)
    },
    onDropRejected: (rejections) => {
      const names = rejections.map((rejection) => rejection.file.name)
      toast({
        type: 'error',
        message:
          names.length > 1
            ? t('kb.filesRejected', { files: names.join(', ') })
            : t('kb.fileRejected'),
      })
    },
  })

  const dropPrompt = replaceResource
    ? t('kb.fileDropPrompt')
    : t('kb.filesDropPrompt')

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
          'aria-label': dropPrompt,
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
            ? progress && progress.total > 1
              ? t('kb.uploadingProgress', {
                  current: progress.current,
                  total: progress.total,
                })
              : t('kb.uploading')
            : (replacementFile?.name ?? dropPrompt)}
        </span>
        <span className="mt-1 text-xs text-slate-500">
          {t('kb.fileUploadFormats')}
        </span>
      </div>
      {replaceResource && replacementFile ? (
        <Button
          onClick={() => void uploadFiles([replacementFile])}
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
