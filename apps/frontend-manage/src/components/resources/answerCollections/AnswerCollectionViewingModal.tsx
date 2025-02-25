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
          <div>{collection.name}</div>
          <div className="mb-0.5 hidden text-base font-normal text-gray-500 md:block">
            {t('manage.resources.byOwner', {
              owner: collection.ownerShortname,
            })}
          </div>
        </div>
      }
      dataCloseButton={{ cy: 'close-viewing-collection-modal' }}
    >
      <Markdown
        content={`**Description:** ${collection.description}`}
        data={{ cy: 'viewing-collection-description' }}
      />
      <div
        className="flex flex-row items-center gap-3"
        data-cy="viewing-collection-access"
      >
        <div className="font-bold">{t('manage.resources.access')}:</div>
        <ObjectAccessLabel accessType={collection.access} />
      </div>
      <div className="mt-2">
        <div className="font-bold">{t('manage.resources.answerOptions')}</div>
        <ul className="list-inside list-disc">
          {collection.entries?.map((entry, ix) => (
            <li key={entry.id} data-cy={`viewing-collection-answer-${ix}`}>
              {entry.value}
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  )
}

export default AnswerCollectionViewingModal
