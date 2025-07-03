import { useQuery } from '@apollo/client'
import { faSearch } from '@fortawesome/free-solid-svg-icons'
import { GetSingleAnswerCollectionDocument } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Modal,
  TextField,
  UserNotification,
} from '@uzh-bf/design-system'
import * as JsSearch from 'js-search'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'

function AnswerCollectionViewingModal({
  collectionId,
  onClose,
}: {
  collectionId: number
  onClose: () => void
}) {
  const t = useTranslations()
  const { data, loading } = useQuery(GetSingleAnswerCollectionDocument, {
    variables: { id: collectionId },
    skip: !open,
  })
  const collection = data?.getSingleAnswerCollection

  // initialize search
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
      onClose={onClose}
      title={
        <div
          className="flex flex-row items-end gap-2"
          data-cy="viewing-collection-title"
        >
          <div className="text-lg font-semibold">
            {loading || !collection
              ? t('shared.generic.loading')
              : collection.name}
          </div>
          {loading || !collection ? null : (
            <div className="mb-0.5 hidden text-base font-normal text-gray-500 md:block">
              {t('manage.resources.byOwner', {
                owner: collection.ownerShortname,
              })}
            </div>
          )}
        </div>
      }
      dataCloseButton={{ cy: 'close-viewing-collection-modal' }}
      className={{ content: 'max-w-2xl pb-2' }}
    >
      {loading || !collection ? (
        <Loader />
      ) : (
        <Accordion
          collapsible
          type="single"
          defaultValue="description"
          className="w-full"
        >
          <AccordionItem value="description">
            <AccordionTrigger
              className="hover:bg-accent px-1 py-2 font-semibold hover:no-underline"
              data-cy="open-collection-description"
            >
              {t('shared.generic.description')}
            </AccordionTrigger>
            <AccordionContent className="px-1">
              <div
                data-cy="viewing-collection-description"
                className="rounded-md bg-gray-100 p-4"
              >
                <Markdown content={collection.description} />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="options">
            <AccordionTrigger
              className="hover:bg-accent px-1 py-2 font-semibold hover:no-underline"
              data-cy="open-collection-options"
            >
              {t('manage.resources.answerOptions')} (
              {collection.entries?.length || 0})
            </AccordionTrigger>
            <AccordionContent className="px-1 pb-2 pt-0.5">
              <TextField
                value={searchQuery}
                onChange={(searchString) => setSearchQuery(searchString)}
                icon={faSearch}
                placeholder={t('manage.resources.searchAnswerOptions')}
                data={{ cy: 'search-viewing-answer-options' }}
                className={{ field: 'mb-2 w-full', input: 'pl-8! h-8 text-sm' }}
              />

              <div className="max-h-[calc(100vh-16rem)] overflow-y-auto rounded-md border border-gray-200">
                {filteredEntries.length === 0 ? (
                  <div className="p-4 text-center">
                    <UserNotification type="info">
                      {t('manage.resources.noMatchingOptions')}
                    </UserNotification>
                  </div>
                ) : (
                  filteredEntries.map((entry, ix) => (
                    <div
                      key={entry.id}
                      data-cy={`viewing-collection-answer-${ix}`}
                      className="break-words border-b border-gray-200 p-3 last:border-b-0 hover:bg-gray-50"
                    >
                      {entry.value}
                    </div>
                  ))
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </Modal>
  )
}

export default AnswerCollectionViewingModal
