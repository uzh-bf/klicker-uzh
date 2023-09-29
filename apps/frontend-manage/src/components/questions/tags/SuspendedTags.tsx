import { useMutation, useSuspenseQuery } from '@apollo/client'
import {
  GetUserTagsDocument,
  Tag,
  UpdateTagOrderingDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import UserTag from './UserTag'

interface Props {
  activeTags: string[]
  handleTagClick: (value: string, selected?: boolean) => void
}

function SuspendedTags({ activeTags, handleTagClick }: Props) {
  const t = useTranslations()

  const { data, error } = useSuspenseQuery(GetUserTagsDocument)
  const [updateTagOrdering] = useMutation(UpdateTagOrderingDocument, {
    refetchQueries: [{ query: GetUserTagsDocument }],
  })

  if (error) {
    return <UserNotification type="error" message={error.message} />
  }

  if (!data?.userTags || data.userTags.length === 0)
    return (
      <UserNotification type="info">
        {t('manage.questionPool.noTagsAvailable')}
      </UserNotification>
    )

  return (
    <ul className="flex flex-col min-h-[4.7rem] overflow-y-auto list-none">
      {data.userTags.map(
        (tag: Tag, ix): React.ReactElement => (
          <UserTag
            key={tag.id}
            tag={tag}
            handleTagClick={handleTagClick}
            active={activeTags.includes(tag.name)}
            onMoveDown={
              ix < data.userTags!.length - 1
                ? () =>
                    updateTagOrdering({
                      variables: { originIx: ix, targetIx: ix + 1 },
                    })
                : undefined
            }
            onMoveUp={
              ix > 0
                ? () =>
                    updateTagOrdering({
                      variables: { originIx: ix, targetIx: ix - 1 },
                    })
                : undefined
            }
          />
        )
      )}
    </ul>
  )
}

export default SuspendedTags
