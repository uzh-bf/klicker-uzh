import { useQuery } from '@apollo/client'
import { faSearch } from '@fortawesome/free-solid-svg-icons'
import { GetSingleAnswerCollectionDocument } from '@klicker-uzh/graphql/dist/ops'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Modal,
  TextField,
  toast,
  UserNotification,
} from '@uzh-bf/design-system'
import * as JsSearch from 'js-search'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import AddAnswerCollectionEntry from './AddAnswerCollectionEntry'
import AnswerCollectionMetaForm from './AnswerCollectionMetaForm'
import AnswerCollectionOption from './AnswerCollectionOption'

function AnswerCollectionEditModal({
  collectionId,
  onClose,
  inlineEditing = false,
  refetchAnswerCollections,
  className,
}: {
  collectionId: number
  onClose: () => void
  inlineEditing?: boolean
  refetchAnswerCollections?: () => Promise<any>
  className?: { overlay?: string; content?: string }
}) {
  const t = useTranslations()

  const [optionsEditingDisabled, setOptionsEditingDisabled] = useState(false)
  const [accordionState, setAccordionState] = useState<'metadata' | 'options'>(
    inlineEditing ? 'options' : 'metadata'
  )
  const [metadataTouched, setMetadataTouched] = useState(false)
  const [optionsTouched, setOptionsTouched] = useState(false)

  // success toast trigger function
  const onSuccessToast = () => {
    toast({
      type: 'success',
      message: t('manage.resources.successfulCollectionEdit'),
      options: { duration: 3000 },
    })
  }

  // error toast trigger function
  const onErrorToast = () => {
    toast({
      type: 'error',
      message: t('manage.resources.saveBeforeClosing'),
      options: { duration: 3000 },
    })
  }

  const { data, loading } = useQuery(GetSingleAnswerCollectionDocument, {
    variables: { id: collectionId },
    fetchPolicy: 'cache-and-network',
    skip: !open,
  })
  const collection = data?.getSingleAnswerCollection

  // setup search
  const [searchQuery, setSearchQuery] = useState('')
  const search = useMemo(() => {
    if (!collection?.entries) {
      return null
    }

    const search = new JsSearch.Search('id')
    search.indexStrategy = new JsSearch.AllSubstringsIndexStrategy()
    search.searchIndex = new JsSearch.UnorderedSearchIndex()
    search.addIndex('value')
    search.addDocuments(collection.entries)
    return search
  }, [collection?.entries])

  // filter entries
  const filteredEntries = useMemo(() => {
    if (!collection?.entries || search === null || searchQuery.trim() === '') {
      return collection?.entries || []
    }

    return search.search(searchQuery) as typeof collection.entries
  }, [collection, search, searchQuery])

  return (
    <Modal
      open
      escapeDisabled
      loading={loading || !collection}
      onClose={() => {
        setOptionsEditingDisabled(false)
        onClose()
      }}
      title={t('manage.resources.answerCollection', {
        name:
          loading || !collection
            ? t('shared.generic.loading')
            : collection.name,
      })}
      dataCloseButton={{ cy: 'close-answer-collection-edit-modal' }}
      className={{
        content: twMerge('max-h-[calc(100vh-1.5rem)] pb-2', className?.content),
        overlay: className?.overlay,
      }}
    >
      {collection && (
        <Accordion
          collapsible
          type="single"
          defaultValue={'metadata'}
          value={accordionState}
          onValueChange={(newValue) => {
            if (metadataTouched || optionsTouched) {
              onErrorToast()
            } else {
              setAccordionState(newValue as 'metadata' | 'options')
            }
          }}
          className="w-full"
        >
          <AccordionItem value="metadata">
            <AccordionTrigger
              className="hover:bg-accent px-1 py-2 text-base font-semibold hover:no-underline"
              data-cy="open-answer-collection-metadata"
            >
              {t('manage.resources.nameAndDescription')}
            </AccordionTrigger>
            <AccordionContent className="px-1">
              <AnswerCollectionMetaForm
                collection={collection}
                onSuccess={() => {
                  setMetadataTouched(false)
                  onSuccessToast()
                }}
                metadataTouched={metadataTouched}
                setMetadataTouched={setMetadataTouched}
                inlineEditing={inlineEditing}
                refetchAnswerCollections={refetchAnswerCollections}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="options">
            <AccordionTrigger
              className="hover:bg-accent px-1 py-2 text-base font-semibold hover:no-underline"
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

              <TextField
                value={searchQuery}
                onChange={(searchString) => setSearchQuery(searchString)}
                icon={faSearch}
                placeholder={t('manage.resources.searchAnswerOptions')}
                data={{ cy: 'search-answer-options' }}
                className={{ field: 'mb-2 w-full', input: 'pl-8! h-8 text-sm' }}
              />
              <div className="my-2 flex max-h-[calc(100vh-35rem)] flex-col gap-1 overflow-y-auto md:max-h-[calc(100vh-29rem)] lg:max-h-[calc(100vh-26rem)]">
                {filteredEntries.length === 0 ? (
                  <UserNotification type="info">
                    {t('manage.resources.noMatchingOptions')}
                  </UserNotification>
                ) : (
                  filteredEntries.map((entry, ix) => (
                    <AnswerCollectionOption
                      key={`collection-entry-${entry.id}`}
                      entry={entry}
                      otherEntries={collection
                        .entries!.filter((e) => e.id !== entry.id)
                        .map((e) => e.value)}
                      last={ix === filteredEntries.length - 1}
                      collectionId={collection.id}
                      deletionDisabled={collection.entries!.length <= 2}
                      editDisabled={optionsEditingDisabled}
                      setEditDisabled={setOptionsEditingDisabled}
                      onTouched={() => setOptionsTouched(true)}
                      onSuccess={() => {
                        setOptionsTouched(false)
                        onSuccessToast()
                      }}
                      inlineEditing={inlineEditing}
                      refetchAnswerCollections={refetchAnswerCollections}
                    />
                  ))
                )}
              </div>
              <AddAnswerCollectionEntry
                collectionId={collection.id}
                entries={collection.entries ?? []}
                setOptionsEditingDisabled={setOptionsEditingDisabled}
                onTouched={() => setOptionsTouched(true)}
                onUntouched={() => {
                  setOptionsTouched(false)
                }}
                onSuccess={() => {
                  setOptionsTouched(false)
                  onSuccessToast()
                }}
                inlineEditing={inlineEditing}
                refetchAnswerCollections={refetchAnswerCollections}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </Modal>
  )
}

export default AnswerCollectionEditModal
