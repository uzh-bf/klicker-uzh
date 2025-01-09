import { useMutation } from '@apollo/client'
import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  AnswerCollection,
  GetAnswerCollectionsDocument,
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
    update: (cache, { data }) => {
      const res = data?.removeAnswerCollection
      if (res === null || typeof res === 'undefined') return

      const prevQuery = cache.readQuery({
        query: GetAnswerCollectionsDocument,
      })
      const collections = prevQuery?.getAnswerCollections
      if (!collections) return

      cache.writeQuery({
        query: GetAnswerCollectionsDocument,
        data: {
          getAnswerCollections: {
            ...collections,
            answerCollections: collections.answerCollections ?? [],
            requestedCollections: collections.requestedCollections ?? [],
            sharedCollections: collections.sharedCollections?.filter(
              (c) => c.id !== res
            ),
          },
        },
      })
    },
  })

  return (
    <Modal
      title={t('manage.resources.removeAnswerCollection')}
      open={removalModal}
      onClose={() => setRemovalModal(false)}
    >
      <div>
        {t('manage.resources.confirmCollectionRemoval', {
          name: collection.name,
        })}
      </div>
      <Button
        onClick={async () => {
          const { data, errors } = await removeAnswerCollection()

          console.log(data, errors)

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
          root: 'float-right mt-4 flex flex-row gap-1.5 border border-red-600',
        }}
        data={{ cy: 'confirm-remove-answer-collection' }}
      >
        <FontAwesomeIcon icon={faTrashCan} />
        <div>
          {t('manage.resources.confirmRemoval', { name: collection.name })}
        </div>
      </Button>
    </Modal>
  )
}

export default CollectionRemovalModal
