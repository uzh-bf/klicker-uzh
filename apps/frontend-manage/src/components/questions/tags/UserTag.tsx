import { faTag } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Tag } from '@klicker-uzh/graphql/dist/ops'
import { Button, Tooltip } from '@uzh-bf/design-system'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import TagActions from './TagActions'
import TagEditForm from './TagEditForm'

function UserTag({
  tag,
  handleTagClick,
  active,
  isStatic = false,
  onMoveDown,
  onMoveUp,
  refetchElements,
}: {
  tag: Tag
  handleTagClick: (tagId: number) => void
  active: boolean
  isStatic?: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
  refetchElements: () => Promise<void>
}) {
  const [editMode, setEditMode] = useState(false)
  const [isDeletionModalOpen, setIsDeletionModalOpen] = useState(false)

  return (
    <>
      <li
        className={twMerge(
          'group flex flex-row items-center justify-between hover:cursor-pointer',
          active && 'text-primary-100'
        )}
      >
        {editMode ? (
          <TagEditForm tag={tag} closeEditMode={() => setEditMode(false)} />
        ) : (
          <div className="flex w-full flex-row items-center gap-2 overflow-hidden">
            <Button
              basic
              fluid
              onClick={(): void => handleTagClick(tag.id)}
              className={{
                root: 'hover:text-primary-100 line-clamp-1 h-7 min-w-0 flex-1 overflow-hidden text-ellipsis py-0 text-sm',
              }}
              data={{ cy: `user-tag-${tag.name}` }}
            >
              <Tooltip
                tooltip={tag.name}
                className={{
                  trigger: 'flex w-full flex-row items-center gap-1 py-1',
                }}
                delay={1000}
              >
                <FontAwesomeIcon icon={faTag} />
                <span className="max-w-full truncate">{tag.name}</span>
              </Tooltip>
            </Button>

            <TagActions
              tag={tag}
              active={active}
              setEditMode={isStatic ? undefined : setEditMode}
              isDeletionModalOpen={isStatic ? undefined : isDeletionModalOpen}
              setIsDeletionModalOpen={
                isStatic ? undefined : setIsDeletionModalOpen
              }
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              refetchElements={refetchElements}
            />
          </div>
        )}
      </li>
    </>
  )
}

export default UserTag
