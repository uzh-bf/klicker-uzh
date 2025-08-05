import { useMutation } from '@apollo/client'
import { faArchive, faInbox } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ToggleIsArchivedDocument,
  type Element,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, toast, Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'

function ArchiveActionButtons({
  selectedElements,
  setSelectedElements,
  refetchElements,
}: {
  selectedElements: Record<number, Element | undefined>
  setSelectedElements: Dispatch<
    SetStateAction<Record<number, Element | undefined>>
  >
  refetchElements: () => Promise<void>
}) {
  const t = useTranslations()
  const [toggleIsArchived, { loading: toggelingArchive }] = useMutation(
    ToggleIsArchivedDocument
  )

  return (
    <>
      <Tooltip tooltip={t('manage.questionPool.moveToArchive')}>
        <Button
          disabled={toggelingArchive}
          className={{ root: 'ml-1 h-10' }}
          onClick={async () => {
            const { data } = await toggleIsArchived({
              variables: {
                elementIds: Object.keys(selectedElements).map((key) =>
                  parseInt(key, 10)
                ),
                isArchived: true,
              },
              update: (cache, { data }) => {
                // if the request was not successful, do nothing
                if (!data?.toggleIsArchived || data.toggleIsArchived.failure)
                  return

                // check if request was successful
                const update = data?.toggleIsArchived
                if (!update) return

                // extract the ids of all elements that should now be marked as archived
                const updatedElementIds =
                  update.elements?.map((element) => element.id) ?? []
              },
            })

            if (data?.toggleIsArchived?.success) {
              await refetchElements()
              toast({
                type: 'success',
                message: t('manage.questionPool.archivingSuccess'),
                options: { duration: 3000 },
              })
              setSelectedElements({})
            } else if (data?.toggleIsArchived?.partialSuccess) {
              toast({
                type: 'warning',
                message: t('manage.questionPool.archivingPartialSuccess'),
                options: { duration: 8000 },
              })
              setSelectedElements({})
            } else if (data?.toggleIsArchived?.failure) {
              toast({
                type: 'error',
                message: t('manage.questionPool.archivingFailed'),
                options: { duration: 8000 },
              })
            }
          }}
          data={{ cy: 'move-to-archive' }}
        >
          <FontAwesomeIcon icon={faArchive} />
        </Button>
      </Tooltip>
      <Tooltip tooltip={t('manage.questionPool.restoreFromArchive')}>
        <Button
          disabled={toggelingArchive}
          className={{ root: 'ml-1 h-10' }}
          onClick={async () => {
            const { data } = await toggleIsArchived({
              variables: {
                elementIds: Object.keys(selectedElements).map((key) =>
                  parseInt(key, 10)
                ),
                isArchived: false,
              },
              update: (cache, { data }) => {
                // if the request was not successful, do nothing
                if (!data?.toggleIsArchived || data.toggleIsArchived.failure)
                  return

                // check if request was successful
                const updatedElements = data?.toggleIsArchived
                if (!updatedElements) return

                // extract the ids of all elements that should now be marked as archived
                const updatedElementIds =
                  updatedElements.elements?.map((element) => element.id) ?? []
              },
            })

            if (data?.toggleIsArchived?.success) {
              await refetchElements()
              toast({
                type: 'success',
                message: t('manage.questionPool.restoreFromArchiveSuccess'),
                options: { duration: 8000 },
              })
              setSelectedElements({})
            } else if (data?.toggleIsArchived?.partialSuccess) {
              toast({
                type: 'warning',
                message: t(
                  'manage.questionPool.restoreFromArchivePartialSuccess'
                ),
                options: { duration: 8000 },
              })
              setSelectedElements({})
            } else if (data?.toggleIsArchived?.failure) {
              toast({
                type: 'error',
                message: t('manage.questionPool.restoreFromArchiveFailed'),
                options: { duration: 8000 },
              })
            }
          }}
          data={{ cy: 'restore-from-archive' }}
        >
          <FontAwesomeIcon icon={faInbox} />
        </Button>
      </Tooltip>
    </>
  )
}

export default ArchiveActionButtons
