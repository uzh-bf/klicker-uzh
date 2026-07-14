import { useApolloClient, useMutation, useSuspenseQuery } from '@apollo/client'
import { BlobServiceClient } from '@azure/storage-blob'
import {
  GetFileUploadSasDocument,
  GetUserMediaFilesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { ReactNode, Suspense, useCallback, useState } from 'react'
import Dropzone, { type FileRejection } from 'react-dropzone'
import { twMerge } from 'tailwind-merge'

interface Props {
  onImageClick: (href: string, name: string) => void
}

interface MediaUploadDropzoneProps {
  accept: Record<string, string[]>
  title: ReactNode
  description?: ReactNode
  activeDescription?: ReactNode
  inputAriaLabel?: string
  compact?: boolean
  isUploading?: boolean
  maxSize?: number
  multiple?: boolean
  onDropAccepted: (files: File[]) => void | Promise<void>
  onDropRejected?: (fileRejections: FileRejection[]) => void
  data?: {
    cy?: string
  }
  className?: {
    root?: string
    title?: string
    description?: string
  }
}

export function MediaUploadDropzone({
  accept,
  title,
  description,
  activeDescription,
  inputAriaLabel,
  compact = false,
  isUploading = false,
  maxSize,
  multiple = false,
  onDropAccepted,
  onDropRejected,
  data,
  className,
}: MediaUploadDropzoneProps) {
  return (
    <Dropzone
      onDropAccepted={onDropAccepted}
      onDropRejected={onDropRejected}
      multiple={multiple}
      accept={accept}
      maxSize={maxSize}
      disabled={isUploading}
    >
      {({ getRootProps, getInputProps, isDragActive }) => (
        <div
          {...getRootProps({
            className: twMerge(
              'flex-1 p-2',
              isUploading
                ? 'cursor-not-allowed opacity-60'
                : 'hover:cursor-pointer hover:bg-slate-100',
              compact ? 'flex min-h-10 items-center' : 'flex min-h-32 flex-col',
              className?.root
            ),
            'data-cy': data?.cy,
            'aria-busy': isUploading,
            'aria-disabled': isUploading,
            'aria-label': inputAriaLabel,
            role: 'button',
            tabIndex: isUploading ? -1 : 0,
          })}
        >
          <div className={twMerge('font-bold', className?.title)}>
            {compact && isDragActive && activeDescription
              ? activeDescription
              : title}
          </div>
          {!compact && (
            <div className={twMerge('mt-2', className?.description)}>
              {isUploading ? (
                <Loader />
              ) : isDragActive && activeDescription ? (
                activeDescription
              ) : (
                description
              )}
            </div>
          )}
          <input
            type="file"
            {...getInputProps({
              'aria-label': inputAriaLabel,
            })}
          />
        </div>
      )}
    </Dropzone>
  )
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
        if (!data?.getFileUploadSas) return

        const blobServiceClient = new BlobServiceClient(
          data.getFileUploadSas.uploadSasURL
        )
        const containerClient = blobServiceClient.getContainerClient(
          data.getFileUploadSas.containerName
        )
        const blobClient = containerClient.getBlobClient(
          data.getFileUploadSas.fileName
        )
        const blockBlobClient = blobClient.getBlockBlobClient()
        await blockBlobClient.uploadData(file, {
          blockSize: 4 * 1024 * 1024, // 4MB block size
        })

        client.refetchQueries({
          include: ['GetUserMediaFiles'],
        })

        onImageClick(data.getFileUploadSas.uploadHref, file.name)
      } finally {
        setIsUploading(false)
      }
    },
    [client, getFileUploadSAS, onImageClick]
  )

  return (
    <>
      <Suspense fallback={<Loader />}>
        <SuspendedMediaFiles onImageClick={onImageClick} />
      </Suspense>

      <MediaUploadDropzone
        accept={{
          'application/image': ['.png', '.jpg', '.jpeg', '.gif'],
        }}
        title={t('manage.elements.uploadImageHeader')}
        description={<p>{t('manage.elements.uploadImageDescription')}</p>}
        isUploading={isUploading}
        onDropAccepted={handleFileFieldChange}
      />
    </>
  )
}

export default MediaLibrary
