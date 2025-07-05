import { useMutation } from '@apollo/client'
import {
  GetUnassignedLiveQuizzesDocument,
  PublicationStatus,
  StartLiveQuizDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { H3, Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'

function StartModal({
  quizId,
  quizName,
  onClose,
}: {
  quizId: string
  quizName: string
  onClose: () => void
}) {
  const t = useTranslations()
  const router = useRouter()
  const [startLiveQuiz, { loading: startingLiveQuiz }] = useMutation(
    StartLiveQuizDocument,
    {
      optimisticResponse: {
        startLiveQuiz: {
          __typename: 'LiveQuizMeta',
          id: quizId,
          name: quizName,
          status: PublicationStatus.Published,
        },
      },
      update(cache) {
        const data = cache.readQuery({
          query: GetUnassignedLiveQuizzesDocument,
        })
        cache.writeQuery({
          query: GetUnassignedLiveQuizzesDocument,
          data: {
            unassignedLiveQuizzes:
              data?.unassignedLiveQuizzes?.map((quiz) =>
                quiz.id === quizId
                  ? {
                      id: quizId,
                      name: quizName,
                      status: PublicationStatus.Published,
                    }
                  : quiz
              ) ?? [],
          },
        })
      },
    }
  )

  return (
    <Modal
      open
      onClose={onClose}
      primaryLabel={t('shared.generic.start')}
      onPrimaryAction={async () => {
        try {
          await startLiveQuiz({
            variables: { id: quizId },
          })
          router.push(`/session/${quizId}`)
        } catch (error) {
          onClose()
          toast({
            type: 'error',
            message: t('control.course.liveQuizStartFailed'),
            options: { duration: 5000 },
          })
        }
      }}
      primaryLoading={startingLiveQuiz}
      dataPrimaryAction={{ cy: 'confirm-start-live-quiz' }}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={onClose}
      dataSecondaryAction={{ cy: 'cancel-start-live-quiz-modal' }}
      className={{ content: 'md:min-w-120 mx-auto my-auto h-max w-max' }}
      hideCloseButton
    >
      <H3>{t('control.course.startLiveQuiz')}</H3>
      <div className="border-uzh-grey-100 bg-uzh-grey-20 rounded border border-solid p-2">
        {t('control.course.confirmStartLiveQuiz')}
        <div className="font-bold">{quizName}</div>
      </div>
      <div className="mt-4 text-sm italic">
        {t('control.course.explanationStartLiveQuiz')}
      </div>
    </Modal>
  )
}

export default StartModal
