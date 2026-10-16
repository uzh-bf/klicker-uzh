import { useApolloClient, useMutation, useSuspenseQuery } from '@apollo/client'
import {
  GetUserMediaFilesDocument,
  RequestMediaUploadDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button } from '@uzh-bf/design-system'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Suspense, useCallback, useState } from 'react'
import Dropzone from 'react-dropzone'
import { uploadMediaFile } from '../../lib/mediaUpload'

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
  const [uploadFailed, setUploadFailed] = useState(false)
  const [requestMediaUpload] = useMutation(RequestMediaUploadDocument)

  const handleFileFieldChange = useCallback(
    async (files: File[]) => {
      const file = files?.[0]
      if (!file) return

      setIsUploading(true)
      setUploadFailed(false)
      try {
        const { data } = await requestMediaUpload({
          variables: { fileName: file.name, contentType: file.type },
        })
        const href = await uploadMediaFile(file, data?.requestMediaUpload)
        onImageClick(href, file.name)
        // Refresh failure must not turn a successful upload into a retry that
        // creates a second object. Reopening the library can retry the query.
        void client
          .refetchQueries({ include: ['GetUserMediaFiles'] })
          .catch(() => undefined)
      } catch {
        setUploadFailed(true)
      } finally {
        setIsUploading(false)
      }
    },
    [client, requestMediaUpload, onImageClick]
  )

  return (
    <Dropzone
      onDrop={handleFileFieldChange}
      multiple={false}
      disabled={isUploading}
      accept={{
        'image/png': ['.png'],
        'image/jpeg': ['.jpg', '.jpeg'],
        'image/gif': ['.gif'],
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
              {t('manage.elements.uploadImageHeader')}
            </div>
            <div className="mt-2">
              {isUploading ? (
                <Loader />
              ) : (
                <p>{t('manage.elements.uploadImageDescription')}</p>
              )}
            </div>
            {uploadFailed && (
              <p
                role="alert"
                data-cy="media-upload-error"
                className="mt-2 text-red-600"
              >
                {t('manage.elements.uploadImageError')}
              </p>
            )}
            <input
              type="file"
              {...getInputProps()}
              data-cy="media-file-input"
            />
          </div>
        </>
      )}
    </Dropzone>
  )
}

export default MediaLibrary
