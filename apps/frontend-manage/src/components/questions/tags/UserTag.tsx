import { faTag } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Tag } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import TagActions from './TagActions'
import TagEditForm from './TagEditForm'

interface Props {
  tag: Tag
  handleTagClick: (tag: string) => void
  active: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
}

function UserTag({ tag, handleTagClick, active, onMoveDown, onMoveUp }: Props) {
  const [editMode, setEditMode] = useState(false)
  const [isDeletionModalOpen, setIsDeletionModalOpen] = useState(false)

  return (
    <>
      <li
        className={twMerge(
          'px-4 py-1 hover:cursor-pointer flex flex-row justify-between group',
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
              className={{ root: 'flex-1 sm:hover:text-primary' }}
            >
              <FontAwesomeIcon icon={faTag} />
              {tag.name}
            </Button>

            <TagActions
              tag={tag}
              active={active}
              setEditMode={setEditMode}
              isDeletionModalOpen={isDeletionModalOpen}
              setIsDeletionModalOpen={setIsDeletionModalOpen}
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
