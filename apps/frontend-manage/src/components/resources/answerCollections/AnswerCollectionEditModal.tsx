import { useQuery } from '@apollo/client'
import { GetSingleAnswerCollectionDocument } from '@klicker-uzh/graphql/dist/ops'
import { H3, Modal, Toast, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import AddAnswerCollectionEntry from './AddAnswerCollectionEntry'
import AnswerCollectionMetaForm from './AnswerCollectionMetaForm'
import AnswerCollectionOption from './AnswerCollectionOption'

function AnswerCollectionEditModal({
  collectionId,
  open,
  onClose,
}: {
  collectionId: number
  open: boolean
  onClose: () => void
}) {
  const t = useTranslations()
  const [successToast, setSuccessToast] = useState(false)
  const [optionsEditingDisabled, setOptionsEditingDisabled] = useState(false)
  const { data, loading } = useQuery(GetSingleAnswerCollectionDocument, {
    variables: { id: collectionId },
    fetchPolicy: 'cache-and-network',
  })

  const collection = data?.getSingleAnswerCollection
  if (loading || !collection) {
    return null
  }

  return (
    <Modal
      escapeDisabled
      open={open}
      onClose={() => {
        setOptionsEditingDisabled(false)
        setSuccessToast(false)
        onClose()
      }}
      title={t('manage.resources.answerCollection', { name: collection.name })}
      dataCloseButton={{ cy: 'close-answer-collection-edit-modal' }}
      className={{ content: 'max-h-[calc(100vh-1.5rem)] overflow-hidden' }}
    >
      <AnswerCollectionMetaForm
        collection={collection}
        setSuccessToast={setSuccessToast}
      />
      <H3 className={{ root: 'mb-0 mt-2' }}>
        {t('manage.resources.answerOptions')}
      </H3>
      <div className="mb-2 text-sm">
        {t('manage.resources.changesImmediateEffect')}
      </div>
      {collection.entries?.some(
        (entry) => (entry.numSolutionUsages ?? 0) > 0
      ) ? (
        <UserNotification
          message={t('manage.resources.answerOptionUsed')}
          type="warning"
          className={{ root: 'mb-2' }}
        />
      ) : null}
      <div className="my-2 flex max-h-[calc(100vh-37rem)] flex-col gap-1 overflow-y-auto">
        {collection.entries!.map((entry, ix) => (
          <AnswerCollectionOption
            key={`collection-entry-${entry.id}`}
            entry={entry}
            otherEntries={collection
              .entries!.filter((e) => e.id !== entry.id)
              .map((e) => e.value)}
            last={ix === collection.entries!.length - 1}
            collectionId={collection.id}
            deletionDisabled={collection.entries!.length <= 2}
            editDisabled={optionsEditingDisabled}
            setEditDisabled={setOptionsEditingDisabled}
          />
        ))}
      </div>
      <AddAnswerCollectionEntry
        collectionId={collection.id}
        entries={collection.entries ?? []}
        setOptionsEditingDisabled={setOptionsEditingDisabled}
      />
      <Toast
        dismissible
        type="success"
        duration={3000}
        openExternal={successToast}
        onCloseExternal={() => setSuccessToast(false)}
      >
        {t('manage.resources.successfulCollectionEdit')}
      </Toast>
    </Modal>
  )
}

export default AnswerCollectionEditModal
