import { useQuery } from '@apollo/client'
import { GetSingleAnswerCollectionDocument } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import ObjectAccessLabel from '../../catalog/ObjectAccessLabel'

function AnswerCollectionViewingModal({
  collectionId,
  open,
  onClose,
  onRemove,
}: {
  collectionId: number
  open: boolean
  onClose: () => void
  onRemove: () => void
}) {
  const t = useTranslations()
  const { data, loading } = useQuery(GetSingleAnswerCollectionDocument, {
    variables: { id: collectionId },
  })

  const collection = data?.getSingleAnswerCollection
  if (loading || !collection) {
    return null
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div
          className="flex flex-row items-end gap-2"
          data-cy="viewing-collection-title"
        >
          <div className="text-lg font-semibold">{collection.name}</div>
          <div className="mb-0.5 hidden text-base font-normal text-gray-500 md:block">
            {t('manage.resources.byOwner', {
              owner: collection.ownerShortname,
            })}
          </div>
        </div>
      }
      dataCloseButton={{ cy: 'close-viewing-collection-modal' }}
      className={{ content: 'max-w-2xl' }}
    >
      <div className="space-y-4">
        <div
          data-cy="viewing-collection-description"
          className="rounded-md bg-gray-100 p-3"
        >
          <div className="mb-1 font-bold">
            {t('shared.generic.description')}:
          </div>
          <Markdown content={collection.description} />
        </div>

        <div
          className="flex flex-row items-center gap-3"
          data-cy="viewing-collection-access"
        >
          <div className="font-bold">{t('manage.resources.access')}:</div>
          <ObjectAccessLabel accessType={collection.access} />
        </div>

        <div>
          <div className="mb-2 font-bold">
            {t('manage.resources.answerOptions')}
          </div>
          <div className="rounded-md border border-gray-200 pr-2">
            {collection.entries?.map((entry, ix) => (
              <div
                key={entry.id}
                data-cy={`viewing-collection-answer-${ix}`}
                className="break-words border-b border-gray-200 p-2 last:border-b-0 hover:bg-gray-50"
              >
                {entry.value}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default AnswerCollectionViewingModal
