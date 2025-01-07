import { useMutation } from '@apollo/client'
import {
  DeleteTagDocument,
  GetUserQuestionsDocument,
  GetUserTagsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

interface TagDeletionModalProps {
  id: number
  name: string
  open: boolean
  setOpen: (value: boolean) => void
}

function TagDeletionModal({ id, name, open, setOpen }: TagDeletionModalProps) {
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
    refetchQueries: [{ query: GetUserQuestionsDocument }],
    optimisticResponse: {
      deleteTag: {
        id: id,
        __typename: 'Tag',
      },
    },
  })

  return (
    <Modal
      onPrimaryAction={
        <Button
          loading={deleting}
          onClick={async () => {
            await deleteTag()
            setOpen(false)
          }}
          className={{
            root: twMerge('bg-red-600 font-bold text-white'),
          }}
          data={{ cy: 'confirm-delete-tag' }}
        >
          {t('shared.generic.confirm')}
        </Button>
      }
      onSecondaryAction={
        <Button
          onClick={(): void => setOpen(false)}
          data={{ cy: 'cancel-delete-tag' }}
        >
          {t('shared.generic.cancel')}
        </Button>
      }
      onClose={(): void => setOpen(false)}
      open={open}
      hideCloseButton={true}
      title={t('manage.tags.deleteTag')}
      className={{
        content: 'h-max min-h-max w-[40rem] self-center pt-0 text-base',
        title: 'text-xl',
      }}
    >
      {t.rich('manage.tags.confirmTagDeletion', {
        name,
        b: (content) => <b>{content}</b>,
      })}
    </Modal>
  )
}

export default TagDeletionModal
