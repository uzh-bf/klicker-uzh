import { useMutation } from '@apollo/client'
import {
  DeleteQuestionDocument,
  ElementType,
  GetUserQuestionsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, H3, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'

function ElementDeletionModal({
  elementId,
  type,
  title,
  content,
  isModalOpen,
  setModalOpen,
  unsetDeletedQuestion,
}: {
  elementId: number
  type: ElementType
  title: string
  content: string
  isModalOpen: boolean
  setModalOpen: Dispatch<SetStateAction<boolean>>
  unsetDeletedQuestion: (questionId: number) => void
}) {
  const t = useTranslations()
  const [deleteQuestion, { loading: deleting }] = useMutation(
    DeleteQuestionDocument
  )

  return (
    <Modal
      hideCloseButton
      onPrimaryAction={
        <Button
          destructive
          loading={deleting}
          onClick={async () => {
            await deleteQuestion({
              variables: {
                id: elementId,
              },
              update(cache) {
                const data = cache.readQuery({
                  query: GetUserQuestionsDocument,
                })
                cache.writeQuery({
                  query: GetUserQuestionsDocument,
                  data: {
                    userQuestions:
                      data?.userQuestions?.filter((e) => e.id !== elementId) ??
                      [],
                  },
                })
              },
              optimisticResponse: {
                deleteQuestion: {
                  id: elementId,
                },
              },
            })
            unsetDeletedQuestion(elementId)
            setModalOpen(false)
          }}
          data={{ cy: 'confirm-question-deletion' }}
        >
          <Button.Label>{t('shared.generic.delete')}</Button.Label>
        </Button>
      }
      onSecondaryAction={
        <Button onClick={(): void => setModalOpen(false)}>
          <Button.Label>{t('shared.generic.cancel')}</Button.Label>
        </Button>
      }
      onClose={(): void => setModalOpen(false)}
      open={isModalOpen}
      className={{
        content: 'h-max min-h-max w-[40rem] self-center !pt-0',
      }}
    >
      <div>
        <H2>{t('manage.questionPool.deleteQuestion')}</H2>
        <div>{t('manage.questionPool.confirmDeletion')}</div>
        <div className="border-uzh-grey-40 mt-1 rounded border border-solid p-2">
          <H3>
            {title} ({t(`shared.${type}.short`)})
          </H3>
          <div>{content}</div>
        </div>
        <div className="mb-2 mt-4 text-sm italic">
          {t('manage.questionPool.noQuestionRecovery')}
        </div>
      </div>
    </Modal>
  )
}

export default ElementDeletionModal
