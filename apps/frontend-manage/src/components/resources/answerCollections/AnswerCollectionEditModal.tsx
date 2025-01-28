import { AnswerCollection } from '@klicker-uzh/graphql/dist/ops'
import { H3, Modal, Toast, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import AddAnswerCollectionEntry from './AddAnswerCollectionEntry'
import AnswerCollectionMetaForm from './AnswerCollectionMetaForm'
import AnswerCollectionOption from './AnswerCollectionOption'

function AnswerCollectionEditModal({
  collection,
  open,
  onClose,
  onDelete,
}: {
  collection: AnswerCollection
  open: boolean
  onClose: () => void
  onDelete: () => void
}) {
  const t = useTranslations()
  const [successToast, setSuccessToast] = useState(false)
  const [optionsEditingDisabled, setOptionsEditingDisabled] = useState(false)

  return (
    <Modal
      open={open}
      onClose={() => {
        setOptionsEditingDisabled(false)
        setSuccessToast(false)
        onClose()
      }}
      title={t('manage.resources.answerCollection', { name: collection.name })}
      dataCloseButton={{ cy: 'close-answer-collection-edit-modal' }}
      escapeDisabled
    >
      <AnswerCollectionMetaForm
        collection={collection}
        setSuccessToast={setSuccessToast}
        onDelete={() => {
          onDelete()
          onClose()
        }}
      />
      <div className="mt-3 flex flex-col gap-1">
        <H3 className={{ root: 'mb-0' }}>
          {t('manage.resources.answerOptions')}
        </H3>
        {collection.entries?.some(
          (entry) => (entry.numSolutionUsages ?? 0) > 0
        ) ? (
          <UserNotification
            message={t('manage.resources.answerOptionUsed')}
            type="warning"
            className={{ root: 'mb-2' }}
          />
        ) : null}
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
        <AddAnswerCollectionEntry
          collectionId={collection.id}
          entries={collection.entries ?? []}
          setOptionsEditingDisabled={setOptionsEditingDisabled}
        />
      </div>
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
