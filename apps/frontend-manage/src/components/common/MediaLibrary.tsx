import { useApolloClient, useMutation, useSuspenseQuery } from '@apollo/client'
import { BlobServiceClient } from '@azure/storage-blob'
import {
  FinalizeFileUploadDocument,
  GetFileUploadSasDocument,
  GetUserMediaFilesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { Suspense, useCallback, useState } from 'react'
import { ErrorCode, type FileRejection } from 'react-dropzone'
import {
  DIRECT_MEDIA_UPLOAD_MAX_BYTES,
  finalizeMediaUploadWithRetry,
} from '../../lib/mediaUpload'
import FileUploadDropzone from './FileUploadDropzone'

interface Props {
  onImageClick: (href: string, name: string) => void
}

function SuspendedMediaFiles({ onImageClick }: Props) {
  const t = useTranslations()

  const { data } = useSuspenseQuery(GetUserMediaFilesDocument)

  return (
    <div className="w-4/5 flex-none border-r p-2">
      <div className="font-bold">{t('manage.elements.mediaLibrary')}</div>
      <div className="grid max-h-64 grid-cols-5 gap-2 overflow-y-auto">
        {data.userMediaFiles?.map((file) => (
          <Button
            className={{ root: 'flex flex-col overflow-hidden text-xs' }}
            key={file.id}
            onClick={() => onImageClick(file.href, file.name)}
            data={{ cy: `media-file-${file.name}` }}
          >
            <Image src={file.href} width={50} height={50} alt={file.name} />
            <Ellipsis maxLines={1} className={{ root: 'text-xs' }}>
              {file.name}
            </Ellipsis>
          </Button>
        ))}
      </div>
    </div>
  )
}

function MediaLibrary({ onImageClick }: Props) {
  const t = useTranslations()
  const client = useApolloClient()
  const [isUploading, setIsUploading] = useState(false)
  const [getFileUploadSAS] = useMutation(GetFileUploadSasDocument)
  const [finalizeFileUpload] = useMutation(FinalizeFileUploadDocument)

  const handleFileRejections = useCallback(
    (fileRejections: FileRejection[]) => {
      const isTooLarge = fileRejections.some((rejection) =>
        rejection.errors.some((error) => error.code === ErrorCode.FileTooLarge)
      )

      toast({
        type: 'error',
        message: isTooLarge
          ? t('manage.elements.uploadImageTooLarge', {
              maxSizeMiB: DIRECT_MEDIA_UPLOAD_MAX_BYTES / 1024 / 1024,
            })
          : t('manage.elements.uploadImageInvalidFileType'),
        options: { duration: 5000 },
      })
    },
    [t]
  )

  const handleFileFieldChange = useCallback(
    async (files: File[]) => {
      const file = files?.[0]
      if (!file) return

      setIsUploading(true)
      try {
        const { data } = await getFileUploadSAS({
          variables: {
            fileName: file.name,
            contentType: file.type,
          },
        })
        const upload = data?.getFileUploadSas
        if (!upload) throw new Error('Media upload target was not created.')

        const blobServiceClient = new BlobServiceClient(upload.uploadSasURL)
        const containerClient = blobServiceClient.getContainerClient(
          upload.containerName
        )
        const blobClient = containerClient.getBlobClient(upload.fileName)
        const blockBlobClient = blobClient.getBlockBlobClient()
        await blockBlobClient.uploadData(file, {
          maxSingleShotSize: DIRECT_MEDIA_UPLOAD_MAX_BYTES,
        })

        await finalizeMediaUploadWithRetry(
          upload.mediaFileId,
          async (mediaFileId) => {
            const finalized = await finalizeFileUpload({
              variables: { mediaFileId },
            })
            return finalized.data?.finalizeFileUpload === true
          }
        )

        onImageClick(upload.uploadHref, file.name)

        // The upload and its server-side fingerprint are already durable.
        // A library refresh failure must not turn that success into a retry.
        void client
          .refetchQueries({ include: ['GetUserMediaFiles'] })
          .catch(() => undefined)
      } catch {
        toast({
          type: 'error',
          message: t('manage.elements.uploadImageFailed'),
          options: { duration: 5000 },
        })
      } finally {
        setIsUploading(false)
      }
    },
    [client, finalizeFileUpload, getFileUploadSAS, onImageClick, t]
  )

  return (
    <>
      <Suspense fallback={<Loader />}>
        <SuspendedMediaFiles onImageClick={onImageClick} />
      </Suspense>

      <FileUploadDropzone
        accept={{
          'image/png': ['.png'],
          'image/jpeg': ['.jpg', '.jpeg'],
          'image/gif': ['.gif'],
        }}
        title={t('manage.elements.uploadImageHeader')}
        description={<p>{t('manage.elements.uploadImageDescription')}</p>}
        isUploading={isUploading}
        maxSize={DIRECT_MEDIA_UPLOAD_MAX_BYTES}
        onDropAccepted={handleFileFieldChange}
        onDropRejected={handleFileRejections}
      />
    </>
  )
}

export default MediaLibrary
