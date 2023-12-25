import {
  faArrowDown,
  faArrowUp,
  faPencil,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Tag } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import TagDeletionModal from './TagDeletionModal'

interface TagActionsProps {
  tag: Tag
  active: boolean
  setEditMode: (editMode: boolean) => void
  isDeletionModalOpen: boolean
  setIsDeletionModalOpen: (isDeletionModalOpen: boolean) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
}

function TagActions({
  tag,
  active,
  setEditMode,
  isDeletionModalOpen,
  setIsDeletionModalOpen,
  onMoveUp,
  onMoveDown,
}: TagActionsProps) {
  return (
    <div className="flex-row hidden text-black group-hover:flex">
      <Button
        basic
        disabled={!onMoveUp}
        onClick={() => onMoveUp?.()}
        className={{
          root: 'disabled:text-uzh-grey-60 sm:hover:text-primary',
        }}
        data={{ cy: `tag-list-item-${tag.name}-move-up` }}
      >
        <FontAwesomeIcon icon={faArrowUp} className="mr-2" />
      </Button>
      <Button
        basic
        disabled={!onMoveDown}
        onClick={() => onMoveDown?.()}
        className={{
          root: 'disabled:text-uzh-grey-60 sm:hover:text-primary',
        }}
        data={{ cy: `tag-list-item-${tag.name}-move-down` }}
      >
        <FontAwesomeIcon icon={faArrowDown} className="mr-2" />
      </Button>
      <Button
        basic
        disabled={active}
        onClick={() => setEditMode(true)}
        className={{
          root: 'disabled:text-uzh-grey-60 sm:hover:text-primary',
        }}
        data={{ cy: `tag-list-item-${tag.name}-edit` }}
      >
        <FontAwesomeIcon icon={faPencil} className="mr-2" />
      </Button>
      <Button
        basic
        disabled={active}
        onClick={() => setIsDeletionModalOpen(true)}
        className={{
          root: 'sm:hover:text-red-600 disabled:text-uzh-grey-60 disabled:hover:text-none',
        }}
        data={{ cy: `tag-list-item-${tag.name}-delete` }}
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
