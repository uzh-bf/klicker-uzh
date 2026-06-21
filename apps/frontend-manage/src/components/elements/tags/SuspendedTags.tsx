import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { TextField, UserNotification } from '@uzh-bf/design-system'
import * as JsSearch from 'js-search'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { trpc } from '../../../lib/trpc'
import type { UserTagData } from './types'
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
  const utils = trpc.useUtils()

  const { data, error, isLoading } = trpc.element.tags.useQuery()
  const updateTagOrdering = trpc.element.updateTagOrdering.useMutation()
  const hasTagData = typeof data !== 'undefined'
  const userTags = data?.tags ?? []

  // setup search
  const [searchQuery, setSearchQuery] = useState('')
  const filteredTags = useMemo(() => {
    if (userTags.length > 0 && searchQuery) {
      const search = new JsSearch.Search('id')
      search.searchIndex = new JsSearch.TfIdfSearchIndex('id')
      search.indexStrategy = new JsSearch.AllSubstringsIndexStrategy()
      search.addIndex('name')
      search.addDocuments(userTags)
      return search.search(searchQuery) as UserTagData[]
    }

    return userTags
  }, [userTags, searchQuery])

  async function moveTag(originIx: number, targetIx: number) {
    await updateTagOrdering.mutateAsync({ originIx, targetIx })
    await utils.element.tags.invalidate()
  }

  if (error && !hasTagData) {
    return (
      <UserNotification
        type="error"
        message={t('shared.generic.systemError')}
      />
    )
  }

  if (isLoading && !hasTagData) {
    return <Loader />
  }

  if (userTags.length === 0)
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
          (tag: UserTagData, ix): React.ReactElement => (
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
                searchQuery === '' && ix < userTags.length - 1
                  ? async () => await moveTag(ix, ix + 1)
                  : undefined
              }
              onMoveUp={
                searchQuery === '' && ix > 0
                  ? async () => await moveTag(ix, ix - 1)
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
