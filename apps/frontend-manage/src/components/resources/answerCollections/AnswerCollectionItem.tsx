import { faClock, faHandPointer } from '@fortawesome/free-regular-svg-icons'
import {
  faDownload,
  faLink,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { AnswerCollection, ObjectAccess } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import ObjectAccessLabel from '../../catalog/ObjectAccessLabel'
import AnswerCollectionEditModal from './AnswerCollectionEditModal'
import AnswerCollectionViewingModal from './AnswerCollectionViewingModal'
import CollectionDeletionModal from './CollectionDeletionModal'
import CollectionRemovalModal from './CollectionRemovalModal'
import RequestCancellationModal from './RequestCancellationModal'

function AnswerCollectionItem({
  collection,
  isOwner = false,
  isEditable = false,
  isImported = false,
  accessGranted = false,
  setDeletionSuccess,
  setDeletionFailure,
  setRemovalSuccess,
  setRemovalFailure,
  setCancellationSuccess,
  setCancellationFailure,
}: {
  collection: AnswerCollection
  isOwner?: boolean
  isEditable?: boolean
  isImported?: boolean
  accessGranted?: boolean
  setDeletionSuccess: Dispatch<SetStateAction<boolean>>
  setDeletionFailure: Dispatch<SetStateAction<boolean>>
  setRemovalSuccess: Dispatch<SetStateAction<boolean>>
  setRemovalFailure: Dispatch<SetStateAction<boolean>>
  setCancellationSuccess: Dispatch<SetStateAction<boolean>>
  setCancellationFailure: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()

  // modal states
  const [editModal, setEditModal] = useState(false)
  const [deletionModal, setDeletionModal] = useState(false)
  const [viewingModal, setViewingModal] = useState(false)
  const [removalModal, setRemovalModal] = useState(false)
  const [cancellationModal, setCancellationModal] = useState(false)

  const collectionAccessMap: Record<ObjectAccess, React.ReactNode> = {
    [ObjectAccess.Private]: (
      <ObjectAccessLabel
        accessType={ObjectAccess.Private}
        className="text-sm"
      />
    ),
    [ObjectAccess.Public]: (
      <ObjectAccessLabel accessType={ObjectAccess.Public} className="text-sm" />
    ),
    [ObjectAccess.Restricted]: (
      <ObjectAccessLabel
        accessType={ObjectAccess.Restricted}
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
          if (isEditable) {
            setEditModal(true)
          }
          // allow viewing of shared collections (not for requested ones)
          else if (accessGranted) {
            setViewingModal(true)
          }
          // allow cancelling a pending request
          else {
            setCancellationModal(true)
          }
        }}
        className={{
          root: 'mb-2 flex flex-row justify-between rounded border border-solid px-2 py-0.5 shadow-sm',
        }}
        data={{ cy: `answer-collection-${collection.name}` }}
      >
        <div className="flex flex-col items-start text-sm">
          <div
            className={twMerge('flex flex-row gap-2', isEditable && 'gap-5')}
          >
            <div className="flex flex-row items-center gap-1.5">
              {!(isOwner && !isImported) && (
                <FontAwesomeIcon
                  icon={isImported ? faDownload : faLink}
                  className="w-5"
                />
              )}
              <div className="text-base">{collection.name}</div>
            </div>
            {isEditable ? (
              collectionAccessMap[collection.access]
            ) : (
              <div className="mb-[0.1rem] self-end text-sm text-gray-500">
                {t('manage.resources.byOwner', {
                  owner:
                    collection.ownerShortname ?? t('shared.generic.unknown'),
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
        {isEditable ? (
          <div className="flex h-full flex-col items-end gap-0.5 self-end text-sm">
            {(collection.numSharedUsers ?? 0) > 0 ? (
              <div className="flex flex-row items-center gap-1.5">
                {collection.numSharedUsers ?? 0}
                <FontAwesomeIcon icon={faUserGroup} />
              </div>
            ) : null}
            <div className="flex flex-row items-center gap-1.5">
              <FontAwesomeIcon icon={faHandPointer} />
              <div>{t('manage.resources.clickToViewEdit')}</div>
            </div>
          </div>
        ) : accessGranted ? (
          <div className="text-primary-100 flex flex-row items-center gap-2 text-sm">
            <FontAwesomeIcon icon={faHandPointer} />
            <div>{t('manage.resources.viewCollection')}</div>
          </div>
        ) : (
          <div className="flex flex-col items-end gap-0.5 py-0.5 text-sm">
            <div className="text-primary-100 flex flex-row items-center gap-2">
              <FontAwesomeIcon icon={faClock} />
              <div>{t('manage.resources.requestedAccess')}</div>
            </div>
            <div className="flex flex-row items-center gap-1.5">
              <FontAwesomeIcon icon={faHandPointer} />
              <div>{t('manage.resources.clickToCancelRequest')}</div>
            </div>
          </div>
        )}
      </Button>
      {isEditable ? (
        <>
          <AnswerCollectionEditModal
            collection={collection}
            open={editModal}
            onClose={() => setEditModal(false)}
            onDelete={() => setDeletionModal(true)}
          />
          <CollectionDeletionModal
            collection={collection}
            deletionModal={deletionModal}
            setDeletionModal={setDeletionModal}
            setDeletionSuccess={setDeletionSuccess}
            setDeletionFailure={setDeletionFailure}
          />
        </>
      ) : null}
      {accessGranted ? (
        <>
          <AnswerCollectionViewingModal
            collection={collection}
            open={viewingModal}
            onClose={() => setViewingModal(false)}
            onRemove={() => setRemovalModal(true)}
          />
          <CollectionRemovalModal
            collection={collection}
            removalModal={removalModal}
            setRemovalModal={setRemovalModal}
            setRemovalSuccess={setRemovalSuccess}
            setRemovalFailure={setRemovalFailure}
          />
        </>
      ) : (
        <>
          <RequestCancellationModal
            collection={collection}
            cancellationModal={cancellationModal}
            setCancellationModal={setCancellationModal}
            setCancellationSuccess={setCancellationSuccess}
            setCancellationFailure={setCancellationFailure}
          />
        </>
      )}
    </>
  )
}

export default AnswerCollectionItem
