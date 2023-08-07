import { useMutation } from '@apollo/client'
import {
  DeleteTagDocument,
  GetUserQuestionsDocument,
  GetUserTagsDocument,
  Tag,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, H3, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface TagDeletionModalProps {
  tag: Tag
  isDeletionModalOpen: boolean
  setIsDeletionModalOpen: (value: boolean) => void
}

function TagDeletionModal({
  tag,
  isDeletionModalOpen,
  setIsDeletionModalOpen,
}: TagDeletionModalProps) {
  const t = useTranslations()
  const [deleteTag] = useMutation(DeleteTagDocument)

  return (
    <Modal
      onPrimaryAction={
        <Button
          onClick={async () => {
            await deleteTag({
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
            })
            setIsDeletionModalOpen(false)
          }}
          className={{ root: 'bg-red-600 font-bold text-white' }}
        >
          {t('shared.generic.delete')}
        </Button>
      }
      onSecondaryAction={
        <Button onClick={(): void => setIsDeletionModalOpen(false)}>
          {t('shared.generic.cancel')}
        </Button>
      }
      onClose={(): void => setIsDeletionModalOpen(false)}
      open={isDeletionModalOpen}
      hideCloseButton={true}
      className={{ content: 'w-[40rem] h-max self-center pt-0' }}
    >
      <div>
        <H2>{t('manage.tags.deleteTag')}</H2>
        <div>{t('manage.tags.confirmTagDeletion')}</div>
        <div className="p-2 mt-1 border border-solid rounded border-uzh-grey-40">
          <H3>{tag.name}</H3>
        </div>
        <div className="mt-6 mb-2 text-sm italic">
          {t('manage.tags.tagDeletionHint')}
        </div>
      </div>
    </Modal>
  )
}

export default TagDeletionModal
