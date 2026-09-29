import {
  faArrowRotateLeft,
  faClock,
  faLock,
  faRightToBracket,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Markdown } from '@klicker-uzh/markdown'
import { Button, H2, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

interface AdaptivePracticeQuizIntroProps {
  displayName: string
  description?: string | null
  maximumQuestions: number
  hasAttempt?: boolean
  previewOnly?: boolean
  loading?: boolean
  onStart: () => void
  onResume: () => void
  onRestart: () => void
}

function AdaptivePracticeQuizIntro({
  displayName,
  description,
  maximumQuestions,
  hasAttempt = false,
  previewOnly = false,
  loading = false,
  onStart,
  onResume,
  onRestart,
}: AdaptivePracticeQuizIntroProps) {
  const t = useTranslations()
  const [restartOpen, setRestartOpen] = useState(false)

  return (
    <section
      className="mx-auto w-full max-w-4xl space-y-6"
      data-cy="adaptive-practice-quiz-intro"
    >
      <div className="space-y-2 border-b pb-5">
        <H2>{displayName}</H2>
        {description ? (
          <Markdown
            content={description}
            className={{ root: 'prose-p:my-2 max-w-none text-slate-700' }}
          />
        ) : (
          <p className="text-slate-700">
            {t('pwa.practiceQuiz.adaptive.intro.purpose')}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <IntroFact
          icon={faClock}
          text={t('pwa.practiceQuiz.adaptive.intro.expectedLength', {
            maximum: maximumQuestions,
          })}
        />
        <IntroFact
          icon={faRightToBracket}
          text={t('pwa.practiceQuiz.adaptive.intro.noBacktracking')}
        />
        <IntroFact
          icon={faArrowRotateLeft}
          text={t('pwa.practiceQuiz.adaptive.intro.resumable')}
        />
        <IntroFact
          icon={faLock}
          text={t('pwa.practiceQuiz.adaptive.intro.privacy')}
        />
      </div>

      {hasAttempt && (
        <div
          className="border-primary-100 bg-primary-20 border-l-4 p-4"
          data-cy="adaptive-practice-quiz-resume-info"
        >
          <div className="font-semibold">
            {t('pwa.practiceQuiz.adaptive.actions.resume')}
          </div>
          <div className="mt-1 text-sm text-slate-700">
            {t('pwa.practiceQuiz.adaptive.intro.resumable')}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          primary
          fluid
          disabled={previewOnly}
          loading={loading}
          onClick={hasAttempt ? onResume : onStart}
          data={{
            cy: hasAttempt
              ? 'resume-adaptive-practice-quiz'
              : 'start-adaptive-practice-quiz',
          }}
          className={{ root: 'sm:w-auto' }}
        >
          <Button.Label>
            {hasAttempt
              ? t('pwa.practiceQuiz.adaptive.actions.resume')
              : t('pwa.practiceQuiz.adaptive.actions.start')}
          </Button.Label>
        </Button>

        {hasAttempt && !previewOnly && (
          <Button
            basic
            disabled={loading}
            onClick={() => setRestartOpen(true)}
            data={{ cy: 'open-restart-adaptive-practice-quiz' }}
          >
            <Button.Icon icon={faArrowRotateLeft} />
            <Button.Label>
              {t('pwa.practiceQuiz.adaptive.actions.startOver')}
            </Button.Label>
          </Button>
        )}
      </div>

      {previewOnly && (
        <p className="text-sm text-slate-600" data-cy="adaptive-preview-note">
          {t('pwa.practiceQuiz.adaptive.preview.description')}
        </p>
      )}

      {restartOpen && (
        <Modal
          open
          hideCloseButton
          title={t('pwa.practiceQuiz.adaptive.actions.startOverTitle')}
          primaryLabel={t('pwa.practiceQuiz.adaptive.actions.startOverConfirm')}
          primaryButtonStyle="destructive"
          primaryLoading={loading}
          onPrimaryAction={() => {
            setRestartOpen(false)
            onRestart()
          }}
          dataPrimaryAction={{ cy: 'confirm-restart-adaptive-practice-quiz' }}
          secondaryLabel={t('shared.generic.cancel')}
          onSecondaryAction={() => setRestartOpen(false)}
          dataSecondaryAction={{ cy: 'cancel-restart-adaptive-practice-quiz' }}
          onClose={() => setRestartOpen(false)}
          className={{ content: 'max-w-xl', title: 'self-start' }}
        >
          <p>{t('pwa.practiceQuiz.adaptive.actions.startOverDescription')}</p>
        </Modal>
      )}
    </section>
  )
}

function IntroFact({ icon, text }: { icon: typeof faClock; text: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3 border-t pt-3 sm:border-l sm:border-t-0 sm:pl-4">
      <FontAwesomeIcon
        icon={icon}
        className="text-primary-100 mt-0.5 h-4 w-4 shrink-0"
      />
      <span className="text-sm leading-5 text-slate-700">{text}</span>
    </div>
  )
}

export default AdaptivePracticeQuizIntro
