import { useQuery } from '@apollo/client'
import {
  AccessType,
  GetAnswerCollectionsDocument,
  PermissionStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { H2 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import AnswerCollectionList from './answerCollections/AnswerCollectionList'
import CollectionDeletionErrorToast from './answerCollections/CollectionDeletionErrorToast'
import CollectionDeletionSuccessToast from './answerCollections/CollectionDeletionSuccessToast'
import CollectionRemovalErrorToast from './answerCollections/CollectionRemovalErrorToast'
import CollectionRemovalSuccessToast from './answerCollections/CollectionRemovalSuccessToast'
import CollectionSharingRequests from './answerCollections/CollectionSharingRequests'
import CreateAddCollection from './answerCollections/CreateAddCollection'
import RequestCancellationErrorToast from './answerCollections/RequestCancellationErrorToast'
import RequestCancellationSuccessToast from './answerCollections/RequestCancellationSuccessToast'
import SharedAnswerCollectionList from './SharedAnswerCollectionList'

function AnswerCollections() {
  const t = useTranslations()
  const { data, loading } = useQuery(GetAnswerCollectionsDocument)

  // action toast states
  const [deletionSuccess, setDeletionSuccess] = useState(false)
  const [deletionFailure, setDeletionFailure] = useState(false)
  const [removalSuccess, setRemovalSuccess] = useState(false)
  const [removalFailure, setRemovalFailure] = useState(false)
  const [cancellationSuccess, setCancellationSuccess] = useState(false)
  const [cancellationFailure, setCancellationFailure] = useState(false)

  // TODO: combine answer collections into one list (requested / shared / own)
  return (
    <div className="h-full w-full">
      <H2>{t('manage.resources.answerCollections')}</H2>
      <div className="mb-2">
        {t('manage.resources.answerCollectionsDescription')}
      </div>
      <CreateAddCollection />
      <CollectionSharingRequests />
      <AnswerCollectionList
        collections={(data?.getAnswerCollections ?? []).filter(
          (collection) => collection.accessType === AccessType.Owner
        )}
        loading={loading}
        setDeletionSuccess={setDeletionSuccess}
        setDeletionFailure={setDeletionFailure}
        setRemovalSuccess={setRemovalSuccess}
        setRemovalFailure={setRemovalFailure}
        setCancellationSuccess={setCancellationSuccess}
        setCancellationFailure={setCancellationFailure}
      />
      <SharedAnswerCollectionList
        sharedCollections={(data?.getAnswerCollections ?? []).filter(
          (collection) =>
            collection.accessType === AccessType.Owner &&
            collection.sharingStatus === PermissionStatus.Granted
        )}
        requestedCollections={(data?.getAnswerCollections ?? []).filter(
          (collection) =>
            collection.accessType === AccessType.Owner &&
            collection.sharingStatus === PermissionStatus.Requested
        )}
        loading={loading}
        setDeletionSuccess={setDeletionSuccess}
        setDeletionFailure={setDeletionFailure}
        setRemovalSuccess={setRemovalSuccess}
        setRemovalFailure={setRemovalFailure}
        setCancellationSuccess={setCancellationSuccess}
        setCancellationFailure={setCancellationFailure}
      />
      <CollectionDeletionSuccessToast
        open={deletionSuccess}
        onClose={() => setDeletionSuccess(false)}
      />
      <CollectionDeletionErrorToast
        open={deletionFailure}
        onClose={() => setDeletionFailure(false)}
      />
      <CollectionRemovalSuccessToast
        open={removalSuccess}
        onClose={() => setRemovalSuccess(false)}
      />
      <CollectionRemovalErrorToast
        open={removalFailure}
        onClose={() => setRemovalFailure(false)}
      />
      <RequestCancellationSuccessToast
        open={cancellationSuccess}
        onClose={() => setCancellationSuccess(false)}
      />
      <RequestCancellationErrorToast
        open={cancellationFailure}
        onClose={() => setCancellationFailure(false)}
      />
    </div>
  )
}

export default AnswerCollections
