import { faClock, faHandPointer } from '@fortawesome/free-regular-svg-icons'
import { faUserGroup } from '@fortawesome/free-solid-svg-icons'
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
import CollectionDeletionErrorToast from './CollectionDeletionErrorToast'
import CollectionDeletionModal from './CollectionDeletionModal'
import CollectionDeletionSuccessToast from './CollectionDeletionSuccessToast'
import CollectionRemovalErrorToast from './CollectionRemovalErrorToast'
import CollectionRemovalModal from './CollectionRemovalModal'
import CollectionRemovalSuccessToast from './CollectionRemovalSuccessToast'
import RequestCancellationErrorToast from './RequestCancellationErrroToast'
import RequestCancellationModal from './RequestCancellationModal'
import RequestCancellationSuccessToast from './RequestCancellationSuccessToast'

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

  // modal states
  const [editModal, setEditModal] = useState(false)
  const [deletionModal, setDeletionModal] = useState(false)
  const [viewingModal, setViewingModal] = useState(false)
  const [removalModal, setRemovalModal] = useState(false)
  const [cancellationModal, setCancellationModal] = useState(false)

  // toast states
  const [deletionSuccess, setDeletionSuccess] = useState(false)
  const [deletionFailure, setDeletionFailure] = useState(false)
  const [removalSuccess, setRemovalSuccess] = useState(false)
  const [removalFailure, setRemovalFailure] = useState(false)
  const [cancellationSuccess, setCancellationSuccess] = useState(false)
  const [cancellationFailure, setCancellationFailure] = useState(false)

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
          <div className="text-primary-100 flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faHandPointer} />
            <div>{t('manage.resources.viewCollection')}</div>
          </div>
        ) : (
          <div className="flex flex-col items-end gap-0.5 py-0.5">
            <div className="text-primary-100 flex flex-row items-center gap-2">
              <FontAwesomeIcon icon={faClock} />
              <div>{t('manage.resources.requestedAccess')}</div>
            </div>
            <div className="flex flex-row items-center gap-1.5 text-sm">
              <FontAwesomeIcon icon={faHandPointer} />
              <div>{t('manage.resources.clickToCancelRequest')}</div>
            </div>
          </div>
        )}
      </Button>
      {editable ? (
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
          <CollectionDeletionSuccessToast
            open={deletionSuccess}
            onClose={() => setDeletionSuccess(false)}
          />
          <CollectionDeletionErrorToast
            open={deletionFailure}
            onClose={() => setDeletionFailure(false)}
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
          <CollectionRemovalSuccessToast
            open={removalSuccess}
            onClose={() => setRemovalSuccess(false)}
          />
          <CollectionRemovalErrorToast
            open={removalFailure}
            onClose={() => setRemovalFailure(false)}
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
          <RequestCancellationSuccessToast
            open={cancellationSuccess}
            onClose={() => setCancellationSuccess(false)}
          />
          <RequestCancellationErrorToast
            open={cancellationFailure}
            onClose={() => setCancellationFailure(false)}
          />
        </>
      )}
    </>
  )
}

export default AnswerCollectionItem
