import { useMutation } from '@apollo/client'
import {
  DeleteTagDocument,
  GetUserElementsDocument,
  GetUserTagsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function TagDeletionModal({
  id,
  name,
  onClose,
}: {
  id: number
  name: string
  onClose: () => void
}) {
  const t = useTranslations()
  const [deleteTag, { loading: deleting }] = useMutation(DeleteTagDocument, {
    variables: {
      id,
    },
    update: (cache, { data }) => {
      if (!data?.deleteTag) return

      const deletedId = data.deleteTag.id
      const prevUserTags = cache.readQuery({
        query: GetUserTagsDocument,
      })
      if (!prevUserTags?.userTags) return

      cache.writeQuery({
        query: GetUserTagsDocument,
        data: {
          userTags: prevUserTags.userTags.filter(
            (tag: { id: number }) => tag.id !== deletedId
          ),
        },
      })
    },
    refetchQueries: [{ query: GetUserElementsDocument }],
    optimisticResponse: {
      deleteTag: {
        id: id,
        __typename: 'Tag',
      },
    },
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={t('manage.tags.deleteTag')}
      primaryLabel={t('shared.generic.confirm')}
      primaryLoading={deleting}
      primaryButtonStyle="destructive"
      onPrimaryAction={async () => {
        await deleteTag()
        onClose()
      }}
      dataPrimaryAction={{ cy: 'confirm-delete-tag' }}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={onClose}
      dataSecondaryAction={{ cy: 'cancel-delete-tag' }}
      className={{ content: 'max-w-xl' }}
    >
      {t.rich('manage.tags.confirmTagDeletion', {
        name,
        b: (content) => <b>{content}</b>,
      })}
    </Modal>
  )
}

export default TagDeletionModal
