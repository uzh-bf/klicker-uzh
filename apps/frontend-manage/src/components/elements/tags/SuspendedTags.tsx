import { useMutation, useSuspenseQuery } from '@apollo/client'
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import {
  GetUserTagsDocument,
  Tag,
  UpdateTagOrderingDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { TextField, UserNotification } from '@uzh-bf/design-system'
import * as JsSearch from 'js-search'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { swapIndices } from 'remeda'
import UserTag from './UserTag'

interface SuspendedTagsProps {
  showUntagged: boolean
  activeTags: string[]
  handleTagClick: ({
    valueOrId,
    isTypeTag,
    isStatusTag,
    isSharingTypeTag,
    isUntagged,
  }: {
    valueOrId: string
    isTypeTag: boolean
    isStatusTag: boolean
    isSharingTypeTag: boolean
    isUntagged: boolean
  }) => void
  refetchElements: () => Promise<void>
}

function SuspendedTags({
  showUntagged,
  activeTags,
  handleTagClick,
  refetchElements,
}: SuspendedTagsProps) {
  const t = useTranslations()

  const { data, error } = useSuspenseQuery(GetUserTagsDocument)
  const [updateTagOrdering] = useMutation(UpdateTagOrderingDocument)

  // setup search
  const [searchQuery, setSearchQuery] = useState('')
  const filteredTags = useMemo(() => {
    if (data?.userTags && searchQuery) {
      const search = new JsSearch.Search('id')
      search.searchIndex = new JsSearch.TfIdfSearchIndex('id')
      search.indexStrategy = new JsSearch.AllSubstringsIndexStrategy()
      search.addIndex('name')
      search.addDocuments(data.userTags)
      return search.search(searchQuery) as Tag[]
    }

    return data?.userTags ?? []
  }, [data?.userTags, searchQuery])

  if (error) {
    return <UserNotification type="error" message={error.message} />
  }

  if (!data?.userTags || data.userTags.length === 0)
    return (
      <div className="px-2">
        <UserNotification type="info" className={{ root: 'py-1' }}>
          {t('manage.questionPool.noTagsAvailable')}
        </UserNotification>
      </div>
    )

  return (
    <>
      <TextField
        placeholder={t('manage.general.searchPlaceholder')}
        value={searchQuery}
        onChange={(newValue) => setSearchQuery(newValue)}
        icon={faMagnifyingGlass}
        className={{
          input: 'pl-8! h-8 text-sm',
          field: 'rounded-md',
        }}
        onReset={() => setSearchQuery('')}
      />
      <ul className="flex min-h-[4.7rem] list-none flex-col overflow-y-auto">
        {filteredTags.map(
          (tag: Tag, ix): React.ReactElement => (
            <UserTag
              key={tag.id}
              tag={tag}
              handleTagClick={(tagId: number) =>
                handleTagClick({
                  valueOrId: tagId.toString(),
                  isTypeTag: false,
                  isStatusTag: false,
                  isSharingTypeTag: false,
                  isUntagged: false,
                })
              }
              active={activeTags.includes(tag.id.toString())}
              onMoveDown={
                searchQuery === '' && ix < data.userTags!.length - 1
                  ? async () =>
                      await updateTagOrdering({
                        variables: { originIx: ix, targetIx: ix + 1 },
                        update: (cache, { data }) => {
                          // check if the reordering operation was successful
                          if (!data?.updateTagOrdering) return

                          // exchange the two corresponding tags
                          cache.updateQuery(
                            { query: GetUserTagsDocument },
                            (qData) => ({
                              userTags: swapIndices(
                                qData?.userTags ?? [],
                                ix,
                                ix + 1
                              ),
                            })
                          )
                        },
                      })
                  : undefined
              }
              onMoveUp={
                searchQuery === '' && ix > 0
                  ? async () =>
                      await updateTagOrdering({
                        variables: { originIx: ix, targetIx: ix - 1 },
                        update: (cache, { data }) => {
                          // check if the reordering operation was successful
                          if (!data?.updateTagOrdering) return

                          // exchange the two corresponding tags
                          cache.updateQuery(
                            { query: GetUserTagsDocument },
                            (qData) => ({
                              userTags: swapIndices(
                                qData?.userTags ?? [],
                                ix - 1,
                                ix
                              ),
                            })
                          )
                        },
                      })
                  : undefined
              }
              refetchElements={refetchElements}
            />
          )
        )}
        <UserTag
          isStatic
          key={'untagged-tag-trigger'}
          active={showUntagged}
          tag={{ id: 0, name: t('manage.questionPool.untagged'), order: 1 }}
          handleTagClick={(tagId: number) =>
            handleTagClick({
              valueOrId: tagId.toString(),
              isTypeTag: false,
              isStatusTag: false,
              isSharingTypeTag: false,
              isUntagged: true,
            })
          }
          refetchElements={refetchElements}
        />
      </ul>
    </>
  )
}

export default SuspendedTags
