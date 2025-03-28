import { useQuery } from '@apollo/client'
import { GetSingleAnswerCollectionDocument } from '@klicker-uzh/graphql/dist/ops'
import { Modal, Toast, UserNotification } from '@uzh-bf/design-system'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@uzh-bf/design-system/dist/future'
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
  const [accordionState, setAccordionState] = useState<'metadata' | 'options'>(
    'metadata'
  )
  const [metadataTouched, setMetadataTouched] = useState(false)
  const [optionsTouched, setOptionsTouched] = useState(false)
  const [saveErrorToast, setSaveErrorToast] = useState(false)

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
      className={{ content: 'max-h-[calc(100vh-1.5rem)] overflow-y-auto' }}
    >
      <Accordion
        collapsible
        type="single"
        defaultValue="metadata"
        value={accordionState}
        onValueChange={(newValue) => {
          if (metadataTouched || optionsTouched) {
            setSaveErrorToast(true)
          } else {
            setAccordionState(newValue as 'metadata' | 'options')
          }
        }}
        className="w-full"
      >
        <AccordionItem value="metadata">
          <AccordionTrigger
            className="hover:bg-accent px-1 py-2 font-semibold hover:no-underline"
            data-cy="open-answer-collection-metadata"
          >
            {t('manage.resources.nameAndDescription')}
          </AccordionTrigger>
          <AccordionContent className="px-1">
            <AnswerCollectionMetaForm
              collection={collection}
              onSuccess={() => {
                setSaveErrorToast(false)
                setSuccessToast(true)
                setMetadataTouched(false)
              }}
              metadataTouched={metadataTouched}
              setMetadataTouched={setMetadataTouched}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="options">
          <AccordionTrigger
            className="hover:bg-accent px-1 py-2 font-semibold hover:no-underline"
            data-cy="open-answer-collection-options"
          >
            {t('manage.resources.answerOptions')}
          </AccordionTrigger>
          <AccordionContent className="px-1 pb-2">
            <div className="my-1.5 text-sm">
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
            <div className="my-2 flex max-h-[calc(100vh-30rem)] flex-col gap-1 overflow-y-auto md:max-h-[calc(100vh-28rem)] lg:max-h-[calc(100vh-24rem)]">
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
                  onTouched={() => setOptionsTouched(true)}
                  onSuccess={() => {
                    setSaveErrorToast(false)
                    setOptionsTouched(false)
                    setSuccessToast(true)
                  }}
                />
              ))}
            </div>
            <AddAnswerCollectionEntry
              collectionId={collection.id}
              entries={collection.entries ?? []}
              setOptionsEditingDisabled={setOptionsEditingDisabled}
              onTouched={() => setOptionsTouched(true)}
              onUntouched={() => {
                setSaveErrorToast(false)
                setOptionsTouched(false)
              }}
              onSuccess={() => {
                setSaveErrorToast(false)
                setOptionsTouched(false)
                setSuccessToast(true)
              }}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Toast
        dismissible
        type="success"
        duration={3000}
        openExternal={successToast}
        onCloseExternal={() => setSuccessToast(false)}
      >
        {t('manage.resources.successfulCollectionEdit')}
      </Toast>
      <Toast
        dismissible
        type="error"
        duration={3000}
        openExternal={saveErrorToast}
        onCloseExternal={() => setSaveErrorToast(false)}
      >
        {t('manage.resources.saveBeforeClosing')}
      </Toast>
    </Modal>
  )
}

export default AnswerCollectionEditModal
