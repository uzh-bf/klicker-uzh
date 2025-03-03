import { useMutation } from '@apollo/client'
import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  AnswerCollection,
  GetAnswerCollectionsInfoDocument,
  RemoveAnswerCollectionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'

function CollectionRemovalModal({
  collection,
  removalModal,
  setRemovalModal,
  setRemovalSuccess,
  setRemovalFailure,
}: {
  collection: AnswerCollection
  removalModal: boolean
  setRemovalModal: Dispatch<SetStateAction<boolean>>
  setRemovalSuccess: Dispatch<SetStateAction<boolean>>
  setRemovalFailure: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()
  const [removeAnswerCollection] = useMutation(RemoveAnswerCollectionDocument, {
    variables: { collectionId: collection.id },
    optimisticResponse: {
      removeAnswerCollection: collection.id,
    },
    refetchQueries: [GetAnswerCollectionsInfoDocument],
  })

  return (
    <Modal
      title={t('manage.resources.removeAnswerCollection')}
      open={removalModal}
      onClose={() => setRemovalModal(false)}
      dataCloseButton={{ cy: 'close-remove-answer-collection' }}
    >
      <div>
        {t('manage.resources.confirmCollectionRemoval', {
          name: collection.name,
        })}
      </div>
      <Button
        destructive
        onClick={async () => {
          const { data, errors } = await removeAnswerCollection()

          if (
            typeof data?.removeAnswerCollection !== 'undefined' &&
            data?.removeAnswerCollection !== null &&
            !errors
          ) {
            setRemovalSuccess(true)
            setRemovalModal(false)
          } else {
            setRemovalFailure(true)
          }
        }}
        className={{
          root: 'float-right mt-4',
        }}
        data={{ cy: 'confirm-remove-answer-collection' }}
      >
        <Button.Icon icon={faTrashCan} />
        <Button.Label>
          {t('manage.resources.confirmRemoval', { name: collection.name })}
        </Button.Label>
      </Button>
    </Modal>
  )
}

export default CollectionRemovalModal
