import { useMutation } from '@apollo/client'
import {
  GetUnassignedLiveQuizzesDocument,
  PublicationStatus,
  StartLiveQuizDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H3, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'

interface StartModalProps {
  quizId: string
  quizName: string
  startModalOpen: boolean
  setStartModalOpen: (open: boolean) => void
  setErrorToast: (open: boolean) => void
}

function StartModal({
  quizId,
  quizName,
  startModalOpen,
  setStartModalOpen,
  setErrorToast,
}: StartModalProps) {
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
      open={startModalOpen}
      onClose={() => setStartModalOpen(false)}
      onPrimaryAction={
        <Button
          loading={startingLiveQuiz}
          onClick={async () => {
            try {
              await startLiveQuiz({
                variables: { id: quizId },
              })
              router.push(`/session/${quizId}`)
            } catch (error) {
              setStartModalOpen(false)
              setErrorToast(true)
            }
          }}
          className={{
            root: 'bg-primary-80 text-white',
          }}
          data={{
            cy: 'confirm-start-session',
          }}
        >
          {t('shared.generic.start')}
        </Button>
      }
      onSecondaryAction={
        <Button
          onClick={() => setStartModalOpen(false)}
          data={{ cy: 'cancel-start-session-modal' }}
        >
          {t('shared.generic.cancel')}
        </Button>
      }
      className={{ content: 'mx-auto my-auto h-max w-max md:min-w-[30rem]' }}
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
