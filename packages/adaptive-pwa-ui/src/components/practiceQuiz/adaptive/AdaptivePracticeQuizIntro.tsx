import {
  faArrowRotateLeft,
  faClock,
  faLock,
  faRepeat,
  faRightToBracket,
} from '@fortawesome/free-solid-svg-icons'
import {
  PracticeQuizOverviewFact,
  PracticeQuizOverviewFactColumn,
  PracticeQuizOverviewFacts,
  PracticeQuizOverviewHeader,
  PracticeQuizStartButton,
} from '@klicker-uzh/shared-components/src/practiceQuiz/PracticeQuizOverviewParts'
import { Button, Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

interface AdaptivePracticeQuizIntroProps {
  displayName: string
  description?: string | null
  maximumQuestions: number
  // Days until a retake: 0 = any time, null = one attempt only,
  // undefined = unknown (not shown).
  retakeCooldownDays?: number | null
  hasAttempt?: boolean
  previewOnly?: boolean
  loading?: boolean
  onStart: () => void
  onResume: () => void
  onRestart: () => void
}

// The adaptive start screen, built from the same overview parts as the
// standard practice quiz so both stay visually aligned.
function AdaptivePracticeQuizIntro({
  displayName,
  description,
  maximumQuestions,
  retakeCooldownDays,
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
      className="flex flex-col space-y-4"
      data-cy="adaptive-practice-quiz-intro"
    >
      <PracticeQuizOverviewHeader
        displayName={displayName}
        description={
          description || t('pwa.practiceQuiz.adaptive.intro.purpose')
        }
      />

      <PracticeQuizOverviewFacts>
        <PracticeQuizOverviewFactColumn>
          <PracticeQuizOverviewFact icon={faClock}>
            <div>
              {t('pwa.practiceQuiz.adaptive.intro.expectedLength', {
                maximum: maximumQuestions,
              })}
            </div>
          </PracticeQuizOverviewFact>
          {typeof retakeCooldownDays !== 'undefined' && (
            <PracticeQuizOverviewFact
              icon={faRepeat}
              cy="adaptive-practice-quiz-repetition"
            >
              <div>
                {retakeCooldownDays === null
                  ? t('pwa.practiceQuiz.adaptive.intro.singleAttempt')
                  : retakeCooldownDays === 0
                    ? t('pwa.practiceQuiz.adaptive.intro.repetitionAnytime')
                    : retakeCooldownDays === 1
                      ? t('pwa.practiceQuiz.repetitionDaily')
                      : t('pwa.practiceQuiz.repetitionXDays', {
                          days: retakeCooldownDays,
                        })}
              </div>
            </PracticeQuizOverviewFact>
          )}
        </PracticeQuizOverviewFactColumn>
        <PracticeQuizOverviewFactColumn>
          <PracticeQuizOverviewFact icon={faRightToBracket}>
            <div>{t('pwa.practiceQuiz.adaptive.intro.noBacktracking')}</div>
          </PracticeQuizOverviewFact>
          <PracticeQuizOverviewFact icon={faArrowRotateLeft}>
            <div>{t('pwa.practiceQuiz.adaptive.intro.resumable')}</div>
          </PracticeQuizOverviewFact>
          <PracticeQuizOverviewFact icon={faLock}>
            <div>{t('pwa.practiceQuiz.adaptive.intro.privacy')}</div>
          </PracticeQuizOverviewFact>
        </PracticeQuizOverviewFactColumn>
      </PracticeQuizOverviewFacts>

      {hasAttempt && (
        <UserNotification
          type="info"
          data={{ cy: 'adaptive-practice-quiz-resume-info' }}
        >
          {t('pwa.practiceQuiz.adaptive.intro.unfinishedAttempt')}
        </UserNotification>
      )}

      <div className="flex flex-row items-center justify-end gap-2">
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
        <PracticeQuizStartButton
          label={
            hasAttempt
              ? t('pwa.practiceQuiz.adaptive.actions.resume')
              : t('pwa.practiceQuiz.adaptive.actions.start')
          }
          onClick={hasAttempt ? onResume : onStart}
          cy={
            hasAttempt
              ? 'resume-adaptive-practice-quiz'
              : 'start-adaptive-practice-quiz'
          }
          disabled={previewOnly}
          loading={loading}
        />
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

export default AdaptivePracticeQuizIntro
