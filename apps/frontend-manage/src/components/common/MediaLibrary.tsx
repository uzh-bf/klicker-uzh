import { BlobServiceClient } from '@azure/storage-blob'
import { Ellipsis } from '@klicker-uzh/markdown'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, UserNotification, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useCallback, useState } from 'react'
import Dropzone from 'react-dropzone'
import { trpc } from '../../lib/trpc'

interface Props {
  onImageClick: (href: string, name: string) => void
}

function SuspendedMediaFiles({ onImageClick }: Props) {
  const t = useTranslations()
  const { data, error, isLoading } = trpc.element.mediaFiles.useQuery()

  if (isLoading && !data) {
    return <Loader />
  }

  return (
    <div className="w-4/5 flex-none border-r p-2">
      <div className="font-bold">{t('manage.elements.mediaLibrary')}</div>
      <div className="grid max-h-64 grid-cols-5 gap-2 overflow-y-auto">
        {error && !data ? (
          <UserNotification
            type="error"
            message={t('shared.generic.systemError')}
            className={{ root: 'col-span-5 text-sm' }}
          />
        ) : (
          data?.mediaFiles.map((file) => (
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
          ))
        )}
      </div>
    </div>
  )
}

function MediaLibrary({ onImageClick }: Props) {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const [isUploading, setIsUploading] = useState(false)
  const getFileUploadSAS = trpc.element.fileUploadSas.useMutation()

  const handleFileFieldChange = useCallback(
    async (files: File[]) => {
      const file = files?.[0]
      if (!file) return

      setIsUploading(true)

      try {
        const data = await getFileUploadSAS.mutateAsync({
          fileName: file.name,
          contentType: file.type,
        })
        if (!data.fileUploadSas) {
          toast({
            type: 'error',
            message: t('shared.generic.systemError'),
            options: { duration: 5000 },
          })
          return
        }

        const blobServiceClient = new BlobServiceClient(
          data.fileUploadSas.uploadSasURL
        )
        const containerClient = blobServiceClient.getContainerClient(
          data.fileUploadSas.containerName
        )
        const blobClient = containerClient.getBlobClient(
          data.fileUploadSas.fileName
        )
        const blockBlobClient = blobClient.getBlockBlobClient()
        await blockBlobClient.uploadData(file, {
          blockSize: 4 * 1024 * 1024, // 4MB block size
        })

        void utils.element.mediaFiles.invalidate().catch(console.error)

        onImageClick(data.fileUploadSas.uploadHref, file.name)
      } catch (error) {
        console.error(error)
        toast({
          type: 'error',
          message: t('shared.generic.systemError'),
          options: { duration: 5000 },
        })
      } finally {
        setIsUploading(false)
      }
    },
    [getFileUploadSAS, onImageClick, t, utils.element.mediaFiles]
  )

  return (
    <Dropzone
      onDrop={handleFileFieldChange}
      multiple={false}
      accept={{
        'application/image': ['.png', '.jpg', '.jpeg', '.gif'],
      }}
    >
      {({ getRootProps, getInputProps }) => (
        <>
          <SuspendedMediaFiles onImageClick={onImageClick} />

          <div
            className="flex-1 p-2 hover:cursor-pointer hover:bg-slate-100"
            {...getRootProps()}
          >
            <div className="font-bold">
              {t('manage.elements.uploadImageHeader')}
            </div>
            <div className="mt-2">
              {isUploading ? (
                <Loader />
              ) : (
                <p>{t('manage.elements.uploadImageDescription')}</p>
              )}
            </div>
            <input type="file" {...getInputProps()} />
          </div>
        </>
      )}
    </Dropzone>
  )
}

export default MediaLibrary
