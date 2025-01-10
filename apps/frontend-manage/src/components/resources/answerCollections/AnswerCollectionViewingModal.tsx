import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { AnswerCollection } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { Button, Modal, Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import CollectionAccessLabel from './CollectionAccessLabel'

function AnswerCollectionViewingModal({
  collection,
  open,
  onClose,
  onRemove,
}: {
  collection: AnswerCollection
  open: boolean
  onClose: () => void
  onRemove: () => void
}) {
  const t = useTranslations()

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
        <CollectionAccessLabel accessType={collection.access} />
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
      <div className="mt-3 flex flex-row items-center gap-3">
        <Button
          type="button"
          onClick={() => {
            onRemove()
            onClose()
          }}
          disabled={!collection.isRemovable}
          className={{
            root: twMerge(
              'border-red-600',
              collection.isRemovable &&
                'hover:border-red-600 hover:text-red-600'
            ),
          }}
          data={{ cy: 'remove-answer-collection' }}
        >
          <FontAwesomeIcon icon={faTrashCan} className="mr-1" />
          <div>{t('manage.resources.removeCollection')}</div>
        </Button>
        {!collection.isRemovable ? (
          <Tooltip
            tooltip={t('manage.resources.removalDisabledInUse')}
            className={{ tooltip: 'max-w-[30rem] text-sm' }}
          >
            <FontAwesomeIcon
              icon={faInfoCircle}
              className="text-primary-100"
              size="lg"
            />
          </Tooltip>
        ) : null}
      </div>
    </Modal>
  )
}

export default AnswerCollectionViewingModal
