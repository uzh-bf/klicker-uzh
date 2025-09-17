import { faBook } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  LQ_DEFAULT_CORRECT_POINTS,
  LQ_DEFAULT_POINTS,
  LQ_MAX_BONUS_POINTS,
  LQ_TIME_TO_ZERO_BONUS,
} from '@klicker-uzh/shared-components/src/constants'
import { FormikNumberField, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import LiveQuizGradingIllustration from './LiveQuizGradingIllustration'

function AdvancedLiveQuizSettings({
  modalOpen,
  setModalOpen,
  multiplier,
  defaultPointsValue,
  correctPointsValue,
  maxBonusValue,
  timeToZeroValue,
  showError,
}: {
  modalOpen: boolean
  setModalOpen: Dispatch<SetStateAction<boolean>>
  multiplier: string
  defaultPointsValue: string
  correctPointsValue: string
  maxBonusValue: string
  timeToZeroValue: string
  showError: boolean
}) {
  const t = useTranslations()

  return (
    <Modal
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      title={t('manage.activityWizard.liveQuizCustomizedGrading')}
      className={{ content: 'pb-0' }}
      dataCloseButton={{ cy: 'live-quiz-advanced-settings-close' }}
      hideCloseButton={showError}
      escapeDisabled={showError}
    >
      <div className="mb-3">
        {t.rich('manage.activityWizard.liveQuizPointsExplanation', {
          link: (text) => (
            <a
              href="https://www.klicker.uzh.ch/gamification/grading_logic/"
              target="_blank"
              rel="noreferrer"
              className="text-primary-100 hover:underline"
            >
              <FontAwesomeIcon icon={faBook} className="ml-1 mr-1.5" />
              {text}
            </a>
          ),
        })}
      </div>
      <div className="flex flex-col gap-6 md:flex-row md:gap-0">
        <div className="w-full md:mr-8 md:w-1/2">
          <FormikNumberField
            required
            min={0}
            precision={0}
            name="defaultPoints"
            label={t('manage.activityWizard.liveQuizDefaultPoints')}
            tooltip={t('manage.activityWizard.liveQuizDefaultPointsTooltip', {
              defaultValue: LQ_DEFAULT_POINTS,
            })}
            data={{
              cy: 'live-quiz-default-points',
            }}
          />
          <FormikNumberField
            required
            min={0}
            precision={0}
            name="defaultCorrectPoints"
            label={t('manage.activityWizard.liveQuizDefaultCorrectPoints')}
            tooltip={t(
              'manage.activityWizard.liveQuizDefaultCorrectPointsTooltip',
              {
                defaultValue: LQ_DEFAULT_CORRECT_POINTS,
              }
            )}
            data={{
              cy: 'live-quiz-default-correct-points',
            }}
          />
          <FormikNumberField
            required
            min={0}
            precision={0}
            name="maxBonusPoints"
            label={t('manage.activityWizard.liveQuizMaxBonusPoints')}
            tooltip={t('manage.activityWizard.liveQuizMaxBonusPointsTooltip', {
              defaultValue: LQ_MAX_BONUS_POINTS,
            })}
            data={{
              cy: 'live-quiz-max-bonus-points',
            }}
          />
          <FormikNumberField
            required
            min={0}
            precision={0}
            name="timeToZeroBonus"
            label={t('manage.activityWizard.liveQuizTimeToZeroBonus')}
            tooltip={t('manage.activityWizard.liveQuizTimeToZeroBonusTooltip', {
              defaultValue: LQ_TIME_TO_ZERO_BONUS,
            })}
            data={{
              cy: 'live-quiz-time-to-zero-bonus',
            }}
          />
        </div>
        <div className="mt-4 w-full md:w-1/2">
          <LiveQuizGradingIllustration
            defaultPointsValue={defaultPointsValue}
            correctPointsValue={correctPointsValue}
            maxBonusValue={maxBonusValue}
            timeToZeroValue={timeToZeroValue}
            multiplier={multiplier}
          />
        </div>
      </div>
    </Modal>
  )
}

export default AdvancedLiveQuizSettings
