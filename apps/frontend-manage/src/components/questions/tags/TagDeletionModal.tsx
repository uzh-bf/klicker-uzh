import { useMutation } from '@apollo/client'
import {
  DeleteTagDocument,
  GetUserQuestionsDocument,
  GetUserTagsDocument,
  Tag,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, H3, Modal } from '@uzh-bf/design-system'

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
          Löschen
        </Button>
      }
      onSecondaryAction={
        <Button onClick={(): void => setIsDeletionModalOpen(false)}>
          Abbrechen
        </Button>
      }
      onClose={(): void => setIsDeletionModalOpen(false)}
      open={isDeletionModalOpen}
      hideCloseButton={true}
      className={{ content: 'w-[40rem] h-max self-center pt-0' }}
    >
      <div>
        <H2>Tag löschen</H2>
        <div>
          Sind Sie sich sicher, dass Sie den folgenden Tag löschen möchten?
        </div>
        <div className="p-2 mt-1 border border-solid rounded border-uzh-grey-40">
          <H3>{tag.name}</H3>
        </div>
        <div className="mt-6 mb-2 text-sm italic">
          Gelöschte Tags können nicht wieder hergestellt werden. Alle Fragen mit
          diesem Tag bleiben bestehen, der Tag wird jedoch entfernt.
        </div>
      </div>
    </Modal>
  )
}

export default TagDeletionModal
