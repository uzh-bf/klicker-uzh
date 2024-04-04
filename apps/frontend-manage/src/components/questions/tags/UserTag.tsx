import { faTag } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Tag } from '@klicker-uzh/graphql/dist/ops'
import { Button, Tooltip } from '@uzh-bf/design-system'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import TagActions from './TagActions'
import TagEditForm from './TagEditForm'

interface Props {
  tag: Tag
  handleTagClick: (tag: string) => void
  active: boolean
  isStatic?: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
}

function UserTag({
  tag,
  handleTagClick,
  active,
  isStatic = false,
  onMoveDown,
  onMoveUp,
}: Props) {
  const [editMode, setEditMode] = useState(false)
  const [isDeletionModalOpen, setIsDeletionModalOpen] = useState(false)

  return (
    <>
      <li
        className={twMerge(
          'px-4 hover:cursor-pointer flex flex-row justify-between group',
          active && 'text-primary'
        )}
      >
        {editMode ? (
          <TagEditForm tag={tag} onConfirm={() => setEditMode(false)} />
        ) : (
          <>
            <Button
              basic
              onClick={(): void => handleTagClick(tag.name)}
              className={{
                root: 'flex-1 sm:hover:text-primary whitespace-nowrap overflow-hidden',
              }}
              data={{ cy: `user-tag-${tag.name}` }}
            >
              <Tooltip
                tooltip={tag.name}
                className={{
                  trigger: 'flex flex-row items-center gap-1 py-1',
                }}
                delay={1000}
              >
                <FontAwesomeIcon icon={faTag} />
                {tag.name}
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
            />
          </>
        )}
      </li>
    </>
  )
}

export default UserTag
