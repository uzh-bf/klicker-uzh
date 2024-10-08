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
import { Suspense, useCallback, useState } from 'react'
import Dropzone from 'react-dropzone'

interface Props {
  onImageClick: (href: string, name: string) => void
}

function SuspendedMediaFiles({ onImageClick }: Props) {
  const t = useTranslations()

  const { data } = useSuspenseQuery(GetUserMediaFilesDocument)

  return (
    <div className="w-4/5 flex-none border-r p-2">
      <div className="font-bold">{t('manage.questionForms.mediaLibrary')}</div>
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
      const result = await blockBlobClient.uploadData(file, {
        blockSize: 4 * 1024 * 1024, // 4MB block size
      })

      client.refetchQueries({
        include: ['GetUserMediaFiles'],
      })

      onImageClick(data.getFileUploadSas.uploadHref, file.name)

      setIsUploading(false)
    },
    [client, getFileUploadSAS, onImageClick]
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
          <Suspense fallback={<Loader />}>
            <SuspendedMediaFiles onImageClick={onImageClick} />
          </Suspense>

          <div
            className="flex-1 p-2 hover:cursor-pointer hover:bg-slate-100"
            {...getRootProps()}
          >
            <div className="font-bold">
              {t('manage.questionForms.uploadImageHeader')}
            </div>
            <div className="mt-2">
              {isUploading ? (
                <Loader />
              ) : (
                <p>{t('manage.questionForms.uploadImageDescription')}</p>
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
