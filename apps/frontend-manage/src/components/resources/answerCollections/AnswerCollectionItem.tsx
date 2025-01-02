import { faClock, faHandPointer } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  AnswerCollection,
  CollectionAccess,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H4 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import AnswerCollectionEditModal from './AnswerCollectionEditModal'
import AnswerCollectionViewingModal from './AnswerCollectionViewingModal'
import CollectionAccessLabel from './CollectionAccessLabel'

function AnswerCollectionItem({
  collection,
  editable = false,
  accessGranted = false,
}: {
  collection: AnswerCollection
  editable?: boolean
  accessGranted?: boolean
}) {
  const t = useTranslations()
  const [editModal, setEditModal] = useState(false)
  const [viewingModal, setViewingModal] = useState(false)
  const collectionAccessMap: Record<CollectionAccess, React.ReactNode> = {
    [CollectionAccess.Private]: (
      <CollectionAccessLabel
        accessType={CollectionAccess.Private}
        className="text-sm"
      />
    ),
    [CollectionAccess.Public]: (
      <CollectionAccessLabel
        accessType={CollectionAccess.Public}
        className="text-sm"
      />
    ),
    [CollectionAccess.Restricted]: (
      <CollectionAccessLabel
        accessType={CollectionAccess.Restricted}
        className="text-sm"
      />
    ),
  }

  return (
    <>
      <Button
        basic
        onClick={() => {
          // open editing modal for own collections
          if (editable) {
            setEditModal(true)
          }

          // allow viewing of shared collections (not for requested ones)
          if (accessGranted) {
            setViewingModal(true)
          }
        }}
        className={{
          root: twMerge(
            'flex flex-row justify-between rounded border border-solid px-2 py-0.5 shadow-sm',
            !editable && !accessGranted && 'cursor-default'
          ),
        }}
      >
        <div className="flex flex-col items-start">
          <div className={twMerge('flex flex-row gap-2', editable && 'gap-5')}>
            <H4 className={{ root: 'mb-0' }}>{collection.name}</H4>
            {editable ? (
              collectionAccessMap[collection.access]
            ) : (
              <div className="mb-[0.1rem] self-end text-sm text-gray-500">
                {t('manage.resources.byOwner', {
                  owner: collection.ownerShortname,
                })}
              </div>
            )}
          </div>
          {typeof collection.entries !== 'undefined' &&
          collection.entries !== null ? (
            <div className="text-sm text-gray-500">
              {t('manage.resources.numOfAnswers', {
                number: collection.entries!.length ?? 0,
              })}
            </div>
          ) : null}
        </div>
        {editable ? (
          <div className="flex flex-row items-center gap-1.5 self-end text-sm">
            <FontAwesomeIcon icon={faHandPointer} />
            <div>{t('manage.resources.clickToViewEdit')}</div>
          </div>
        ) : accessGranted ? (
          <div className="text-primary-100 flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faHandPointer} />
            <div>{t('manage.resources.viewCollection')}</div>
          </div>
        ) : (
          <div className="text-primary-100 flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faClock} />
            <div>{t('manage.resources.requestedAccess')}</div>
          </div>
        )}
      </Button>
      {editable ? (
        <AnswerCollectionEditModal
          collection={collection}
          open={editModal}
          onClose={() => setEditModal(false)}
        />
      ) : null}
      {accessGranted ? (
        <AnswerCollectionViewingModal
          collection={collection}
          open={viewingModal}
          onClose={() => setViewingModal(false)}
        />
      ) : null}
    </>
  )
}

export default AnswerCollectionItem
