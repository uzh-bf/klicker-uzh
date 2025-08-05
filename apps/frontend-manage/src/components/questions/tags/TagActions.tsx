import {
  faArrowDown,
  faArrowUp,
  faPencil,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { Tag } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import TagDeletionModal from '../../courses/modals/TagDeletionModal'

interface TagActionsProps {
  tag: Tag
  active: boolean
  setEditMode?: (editMode: boolean) => void
  isDeletionModalOpen?: boolean
  setIsDeletionModalOpen?: (isDeletionModalOpen: boolean) => void
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
    <div className="hidden flex-row items-center text-black group-hover:flex">
      {onMoveUp && (
        <Button
          basic
          disabled={!onMoveUp}
          onClick={() => onMoveUp?.()}
          className={{
            root: 'disabled:text-uzh-grey-60 hover:text-primary-100 px-1',
          }}
          data={{ cy: `tag-list-item-${tag.name}-move-up` }}
        >
          <Button.Icon withoutLabel icon={faArrowUp} />
        </Button>
      )}
      {onMoveDown && (
        <Button
          basic
          disabled={!onMoveDown}
          onClick={() => onMoveDown?.()}
          className={{
            root: 'disabled:text-uzh-grey-60 hover:text-primary-100 px-1',
          }}
          data={{ cy: `tag-list-item-${tag.name}-move-down` }}
        >
          <Button.Icon withoutLabel icon={faArrowDown} />
        </Button>
      )}
      {setEditMode && (
        <Button
          basic
          disabled={active}
          onClick={() => setEditMode(true)}
          className={{
            root: 'disabled:text-uzh-grey-60 hover:text-primary-100 px-1',
          }}
          data={{ cy: `tag-list-item-${tag.name}-edit` }}
        >
          <Button.Icon withoutLabel icon={faPencil} />
        </Button>
      )}
      {setIsDeletionModalOpen && (
        <Button
          basic
          disabled={active}
          onClick={() => setIsDeletionModalOpen(true)}
          className={{
            root: 'disabled:text-uzh-grey-60 disabled:hover:text-none px-1 hover:text-red-600',
          }}
          data={{ cy: `tag-list-item-${tag.name}-delete` }}
        >
          <Button.Icon withoutLabel icon={faTrash} />
        </Button>
      )}
      {isDeletionModalOpen && setIsDeletionModalOpen ? (
        <TagDeletionModal
          id={tag.id}
          name={tag.name}
          onClose={() => setIsDeletionModalOpen(false)}
        />
      ) : null}
    </div>
  )
}

export default TagActions
