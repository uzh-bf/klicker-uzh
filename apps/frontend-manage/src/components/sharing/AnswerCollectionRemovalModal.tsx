import { useMutation } from '@apollo/client'
import { faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetAnswerCollectionsInfoDocument,
  ObjectType,
  RemoveObjectDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function AnswerCollectionRemovalModal({
  id,
  name,
  onClose,
}: {
  id: number
  name: string
  onClose: () => void
}) {
  const t = useTranslations()
  const [removeObject, { loading: removing }] =
    useMutation(RemoveObjectDocument)

  const onRemovalError = () =>
    toast({
      type: 'error',
      message: t('manage.sharing.removalFailed'),
      options: { duration: 3000 },
    })

  return (
    <Modal
      open
      title={t(`manage.sharing.remove${ObjectType.AnswerCollection}`)}
      onClose={onClose}
      primaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          {!removing && <FontAwesomeIcon icon={faX} />}
          <span>{t('manage.sharing.confirmRemoval')}</span>
        </div>
      }
      primaryButtonStyle="destructive"
      primaryLoading={removing}
      onPrimaryAction={async () => {
        try {
          const res = await removeObject({
            variables: {
              objectId: String(id),
              objectType: ObjectType.AnswerCollection,
            },
            update: (cache, { data }) => {
              // check if the removal was successful
              if (!data?.removeObject) return

              // update the cache to remove the deleted collection
              const answerCollectionId = parseInt(data.removeObject, 10)
              cache.updateQuery(
                { query: GetAnswerCollectionsInfoDocument },
                (qData) => {
                  if (!qData?.getAnswerCollectionsInfo) return qData

                  return {
                    getAnswerCollectionsInfo:
                      qData.getAnswerCollectionsInfo.filter(
                        (collection) => collection.id !== answerCollectionId
                      ),
                  }
                }
              )
            },
          })

          if (
            typeof res.data?.removeObject !== 'undefined' &&
            res.data?.removeObject !== null
          ) {
            toast({
              type: 'success',
              message: t('manage.sharing.removalSuccessful'),
              options: { duration: 3000 },
            })
            onClose()
          } else {
            onRemovalError()
          }
        } catch (error) {
          onRemovalError()
          console.error(error)
        }
      }}
      dataPrimaryAction={{ cy: 'confirm-remove-object' }}
      dataCloseButton={{ cy: 'close-remove-object' }}
      className={{ content: 'max-w-xl', footer: 'justify-end' }}
    >
      {t(`manage.sharing.confirmRemoval${ObjectType.AnswerCollection}`, {
        objectName: name,
      })}
    </Modal>
  )
}

export default AnswerCollectionRemovalModal
