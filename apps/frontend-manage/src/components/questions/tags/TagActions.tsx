import { useMutation } from '@apollo/client'
import DeletionModal from '@components/courses/modals/DeletionModal'
import {
  faArrowDown,
  faArrowUp,
  faPencil,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  DeleteTagDocument,
  GetUserQuestionsDocument,
  GetUserTagsDocument,
  Tag,
} from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

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
  const t = useTranslations()
  const [deleteTag] = useMutation(DeleteTagDocument, {
    variables: {
      id: tag.id,
    },
    refetchQueries: [
      {
        query: GetUserTagsDocument,
      },
      {
        query: GetUserQuestionsDocument,
      },
    ],
    optimisticResponse: {
      deleteTag: {
        id: tag.id,
        __typename: 'Tag',
      },
    },
  })

  return (
    <div className="flex-row hidden text-black group-hover:flex">
      {onMoveUp && (
        <Button
          basic
          disabled={!onMoveUp}
          onClick={() => onMoveUp?.()}
          className={{
            root: 'disabled:text-uzh-grey-60 hover:text-primary-100',
          }}
          data={{ cy: `tag-list-item-${tag.name}-move-up` }}
        >
          <FontAwesomeIcon icon={faArrowUp} className="mr-2" />
        </Button>
      )}
      {onMoveDown && (
        <Button
          basic
          disabled={!onMoveDown}
          onClick={() => onMoveDown?.()}
          className={{
            root: 'disabled:text-uzh-grey-60 hover:text-primary-100',
          }}
          data={{ cy: `tag-list-item-${tag.name}-move-down` }}
        >
          <FontAwesomeIcon icon={faArrowDown} className="mr-2" />
        </Button>
      )}
      {setEditMode && (
        <Button
          basic
          disabled={active}
          onClick={() => setEditMode(true)}
          className={{
            root: 'disabled:text-uzh-grey-60 hover:text-primary-100',
          }}
          data={{ cy: `tag-list-item-${tag.name}-edit` }}
        >
          <FontAwesomeIcon icon={faPencil} className="mr-2" />
        </Button>
      )}
      {setIsDeletionModalOpen && (
        <Button
          basic
          disabled={active}
          onClick={() => setIsDeletionModalOpen(true)}
          className={{
            root: 'hover:text-red-600 disabled:text-uzh-grey-60 disabled:hover:text-none',
          }}
          data={{ cy: `tag-list-item-${tag.name}-delete` }}
        >
          <FontAwesomeIcon icon={faTrash} className="mr-2" />
        </Button>
      )}
      {setIsDeletionModalOpen && (
        <DeletionModal
          title={t('manage.tags.deleteTag')}
          description={t('manage.tags.confirmTagDeletion')}
          elementName={tag.name}
          message={t('manage.tags.tagDeletionHint')}
          deleteElement={deleteTag}
          open={isDeletionModalOpen ?? false}
          setOpen={setIsDeletionModalOpen}
          primaryData={{ cy: 'confirm-delete-tag' }}
          secondaryData={{ cy: 'cancel-delete-tag' }}
        />
      )}
    </div>
  )
}

export default TagActions
