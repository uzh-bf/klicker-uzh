import { useMutation, useSuspenseQuery } from '@apollo/client'
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import {
  GetUserTagsDocument,
  Tag,
  UpdateTagOrderingDocument,
} from '@klicker-uzh/graphql/dist/ops'
import useSortingAndFiltering from '@lib/hooks/useSortingAndFiltering'
import { TextField, UserNotification } from '@uzh-bf/design-system'
import * as JsSearch from 'js-search'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import UserTag from './UserTag'

interface Props {
  showUntagged: boolean
  activeTags: string[]
  handleTagClick: ({
    tagName,
    isTypeTag,
    isStatusTag,
    isUntagged,
  }: {
    tagName: string
    isTypeTag: boolean
    isStatusTag: boolean
    isUntagged: boolean
  }) => void
}

function SuspendedTags({ showUntagged, activeTags, handleTagClick }: Props) {
  const t = useTranslations()

  const [searchInput, setSearchInput] = useState('')

  const { data, error } = useSuspenseQuery(GetUserTagsDocument)
  const [updateTagOrdering] = useMutation(UpdateTagOrderingDocument, {
    refetchQueries: [{ query: GetUserTagsDocument }],
  })

  const { handleSearch } = useSortingAndFiltering()

  const filteredTags = useMemo(() => {
    if (data?.userTags) {
      const search = new JsSearch.Search('id')
      search.searchIndex = new JsSearch.TfIdfSearchIndex('id')
      search.indexStrategy = new JsSearch.AllSubstringsIndexStrategy()
      search.addIndex('name')
      search.addDocuments(data.userTags)

      if (searchInput) {
        return search.search(searchInput) as Tag[]
      }

      return data.userTags
    }

    return []
  }, [data?.userTags, searchInput])

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
    <div>
      <TextField
        placeholder={t('manage.general.searchPlaceholder')}
        value={searchInput}
        onChange={(newValue: string) => {
          setSearchInput(newValue)
          handleSearch(newValue)
        }}
        icon={faMagnifyingGlass}
        className={{
          input: 'h-8 pl-8 text-sm',
          field: 'rounded-md pr-3',
        }}
      />
      <ul className="flex min-h-[4.7rem] list-none flex-col overflow-y-auto">
        {filteredTags.map(
          (tag: Tag, ix): React.ReactElement => (
            <UserTag
              key={tag.id}
              tag={tag}
              handleTagClick={(tag: string) =>
                handleTagClick({
                  tagName: tag,
                  isTypeTag: false,
                  isStatusTag: false,
                  isUntagged: false,
                })
              }
              active={activeTags.includes(tag.name)}
              onMoveDown={
                searchInput === '' && ix < data.userTags!.length - 1
                  ? async () =>
                      await updateTagOrdering({
                        variables: { originIx: ix, targetIx: ix + 1 },
                      })
                  : undefined
              }
              onMoveUp={
                searchInput === '' && ix > 0
                  ? async () =>
                      await updateTagOrdering({
                        variables: { originIx: ix, targetIx: ix - 1 },
                      })
                  : undefined
              }
            />
          )
        )}
        <UserTag
          key={'untagged-tag-trigger'}
          tag={{ id: 0, name: t('manage.questionPool.untagged'), order: 1 }}
          handleTagClick={(tag: string) =>
            handleTagClick({
              tagName: tag,
              isTypeTag: false,
              isStatusTag: false,
              isUntagged: true,
            })
          }
          active={showUntagged}
          isStatic
        />
      </ul>
    </div>
  )
}

export default SuspendedTags
