import { faPencil, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Tag } from '@klicker-uzh/graphql/dist/ops'
import { Button, ThemeContext } from '@uzh-bf/design-system'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'
import TagDeletionModal from './TagDeletionModal'

interface TagActionsProps {
  tag: Tag
  active: boolean
  setEditMode: (editMode: boolean) => void
  isDeletionModalOpen: boolean
  setIsDeletionModalOpen: (isDeletionModalOpen: boolean) => void
}

function TagActions({
  tag,
  active,
  setEditMode,
  isDeletionModalOpen,
  setIsDeletionModalOpen,
}: TagActionsProps) {
  const theme = useContext(ThemeContext)

  return (
    <div className="flex-row hidden text-black group-hover:flex">
      <Button
        basic
        disabled={active}
        onClick={() => setEditMode(true)}
        className={{
          root: twMerge(theme.primaryTextHover, 'disabled:text-uzh-grey-60'),
        }}
      >
        <FontAwesomeIcon icon={faPencil} className="mr-2" />
      </Button>
      <Button
        basic
        disabled={active}
        onClick={() => setIsDeletionModalOpen(true)}
        className={{
          root: 'hover:text-red-600 disabled:text-uzh-grey-60 disabled:hover:text-none',
        }}
      >
        <FontAwesomeIcon icon={faTrash} className="mr-2" />
      </Button>

      <TagDeletionModal
        tag={tag}
        isDeletionModalOpen={isDeletionModalOpen}
        setIsDeletionModalOpen={setIsDeletionModalOpen}
      />
    </div>
  )
}

export default TagActions
