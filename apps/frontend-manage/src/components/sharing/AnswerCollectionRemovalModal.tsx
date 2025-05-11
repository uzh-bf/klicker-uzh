import { useMutation } from '@apollo/client'
import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  GetAnswerCollectionsInfoDocument,
  RemoveObjectDocument,
  SharingObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'

function AnswerCollectionRemovalModal({
  id,
  name,
  removalModal,
  setRemovalModal,
  setRemovalSuccess,
  setRemovalFailure,
}: {
  id: number
  name: string
  removalModal: boolean
  setRemovalModal: Dispatch<SetStateAction<boolean>>
  setRemovalSuccess: Dispatch<SetStateAction<boolean>>
  setRemovalFailure: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()
  const [removeObject, { loading: removing }] =
    useMutation(RemoveObjectDocument)

  return (
    <Modal
      title={t(`manage.sharing.remove${SharingObjectType.AnswerCollection}`)}
      open={removalModal}
      onClose={() => setRemovalModal(false)}
      dataCloseButton={{ cy: 'close-remove-object' }}
    >
      <div>
        {t(
          `manage.sharing.confirmRemoval${SharingObjectType.AnswerCollection}`,
          {
            objectName: name,
          }
        )}
      </div>
      <Button
        destructive
        loading={removing}
        onClick={async () => {
          try {
            const res = await removeObject({
              variables: {
                objectId: String(id),
                objectType: SharingObjectType.AnswerCollection,
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
              setRemovalSuccess(true)
              setRemovalModal(false)
            } else {
              setRemovalFailure(true)
            }
          } catch (error) {
            setRemovalFailure(true)
            console.error(error)
          }
        }}
        className={{
          root: 'float-right mt-4',
        }}
        data={{ cy: 'confirm-remove-object' }}
      >
        <Button.Icon icon={faTrashCan} loading={removing} />
        <Button.Label>{t('manage.sharing.confirmRemoval')}</Button.Label>
      </Button>
    </Modal>
  )
}

export default AnswerCollectionRemovalModal
