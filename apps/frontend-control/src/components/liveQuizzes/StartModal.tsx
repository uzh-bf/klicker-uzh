import { trpc } from '@lib/trpc'
import { H3, Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'

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
  const utils = trpc.useUtils()
  const [startPending, setStartPending] = useState(false)
  const startLiveQuiz = trpc.liveQuiz.start.useMutation()
  const loading = startLiveQuiz.isLoading || startPending
  const handleClose = () => {
    if (!loading) {
      onClose()
    }
  }

  return (
    <Modal
      open
      onClose={handleClose}
      primaryLabel={t('shared.generic.start')}
      onPrimaryAction={async () => {
        if (loading) return
        setStartPending(true)

        try {
          const response = await startLiveQuiz.mutateAsync({ id: quizId })
          if (!response.liveQuiz?.id) throw new Error('Live quiz not started')
        } catch (error) {
          console.error(error)
          toast({
            type: 'error',
            message: t('control.course.liveQuizStartFailed'),
            options: { duration: 5000 },
          })
          setStartPending(false)
          return
        }

        void Promise.all([
          utils.liveQuiz.unassigned.invalidate(),
          utils.course.controlCourses.invalidate(),
        ]).catch((error) => {
          console.error('Error refreshing control live quiz lists', error)
        })

        try {
          const routed = await router.push(`/session/${quizId}`)
          if (!routed) {
            window.location.assign(`/session/${encodeURIComponent(quizId)}`)
            return
          }
          onClose()
        } catch (error) {
          console.error(error)
          toast({
            type: 'error',
            message: t('shared.generic.systemError'),
            options: { duration: 5000 },
          })
          setStartPending(false)
        }
      }}
      primaryLoading={loading}
      primaryDisabled={loading}
      dataPrimaryAction={{ cy: 'confirm-start-live-quiz' }}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={handleClose}
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
