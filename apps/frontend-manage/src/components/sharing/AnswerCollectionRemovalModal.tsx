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
import { Dispatch, SetStateAction } from 'react'

function AnswerCollectionRemovalModal({
  id,
  name,
  removalModal,
  setRemovalModal,
}: {
  id: number
  name: string
  removalModal: boolean
  setRemovalModal: Dispatch<SetStateAction<boolean>>
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
      title={t(`manage.sharing.remove${ObjectType.AnswerCollection}`)}
      open={removalModal}
      onClose={() => setRemovalModal(false)}
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
            optimisticResponse: {
              removeObject: String(id),
            },
            refetchQueries: [{ query: GetAnswerCollectionsInfoDocument }],
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
            setRemovalModal(false)
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
