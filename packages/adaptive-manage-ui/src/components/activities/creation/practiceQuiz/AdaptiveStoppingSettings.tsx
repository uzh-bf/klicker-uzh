import { FormikNumberField, Select, Switch } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import type { AdaptivePracticeQuizConfigFormValues } from '../../../../types/practiceQuiz'
import { isPlacementPilotConfig } from './adaptivePracticeQuizForm'

const INTERVALS = ['1.28', '1.645', '1.96'] as const

function AdaptiveStoppingSettings({
  config,
  onChange,
}: {
  config: AdaptivePracticeQuizConfigFormValues
  onChange: (config: AdaptivePracticeQuizConfigFormValues) => void
}) {
  const t = useTranslations('manage.activityWizard.adaptive.stopping')
  const update = (patch: Partial<AdaptivePracticeQuizConfigFormValues>) =>
    onChange({ ...config, ...patch })
  const placementPilot = isPlacementPilotConfig(config)
  const custom = !INTERVALS.some(
    (value) => Number(value) === Number(config.classificationZ)
  )
  return (
    <section
      className="space-y-4 rounded border border-gray-200 p-4"
      data-cy="adaptive-stopping-settings"
    >
      <div>
        <h3 className="font-semibold">{t('title')}</h3>
        {!placementPilot && (
          <p className="mt-1 text-sm text-gray-600">{t('description')}</p>
        )}
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <FormikNumberField
            id="adaptive-total-question-cap"
            label={t('maxQuestions')}
            name="adaptiveConfig.totalQuestionCap"
            min={1}
            max={1000}
            precision={0}
            className={{ root: 'min-w-0', label: 'min-w-0 whitespace-normal' }}
            data={{ cy: 'adaptive-total-question-cap' }}
          />
          <p className="mt-1 text-sm text-gray-600">{t('maxQuestionsHint')}</p>
        </div>
        <div>
          {config.scaleVersionId ? (
            <p
              className="text-sm text-gray-600"
              data-cy="adaptive-stopping-scale-policy"
            >
              {placementPilot ? t('pilotPolicy') : t('scalePolicy')}
            </p>
          ) : (
            <>
              <label
                className="mb-1 block text-sm font-bold"
                htmlFor="adaptive-confidence-interval"
              >
                {t('interval')}
              </label>
              <Select
                id="adaptive-confidence-interval"
                value={config.classificationZ}
                onChange={(classificationZ) => update({ classificationZ })}
                items={[
                  ...INTERVALS.map((value, index) => ({
                    value,
                    label: t(
                      (['interval80', 'interval90', 'interval95'] as const)[
                        index
                      ]!
                    ),
                  })),
                  ...(custom
                    ? [
                        {
                          value: config.classificationZ,
                          label: t('customInterval', {
                            value: config.classificationZ,
                          }),
                        },
                      ]
                    : []),
                ]}
                data={{ cy: 'adaptive-confidence-interval' }}
                className={{ root: 'w-full', trigger: 'w-full' }}
              />
              <p className="mt-1 text-sm text-gray-600">{t('intervalHint')}</p>
            </>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Switch
          id="adaptive-quiz-time-limit"
          label={t('enableTimeLimit')}
          aria-label={t('enableTimeLimit')}
          checked={Boolean(config.timeLimitMinutes)}
          onCheckedChange={(enabled) =>
            update({ timeLimitMinutes: enabled ? '30' : '' })
          }
          data={{ cy: 'adaptive-quiz-time-limit-toggle' }}
        />
        {config.timeLimitMinutes && (
          <FormikNumberField
            id="adaptive-quiz-duration-minutes"
            name="adaptiveConfig.timeLimitMinutes"
            min={1}
            precision={0}
            className={{ root: 'min-w-0', label: 'min-w-0 whitespace-normal' }}
            label={t('timeLimitMinutes')}
            data={{ cy: 'adaptive-quiz-time-limit-minutes' }}
          />
        )}
        <p className="text-sm text-gray-600">{t('limitHint')}</p>
      </div>
      <details
        className="border-t border-gray-200 pt-3"
        data-cy="adaptive-coverage-settings"
      >
        <summary className="cursor-pointer text-sm font-semibold">
          {t('coverage')}
        </summary>
        <p className="my-2 text-sm text-gray-600">{t('coverageHint')}</p>
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <FormikNumberField
            id="adaptive-min-questions-per-leaf"
            label={t('minPerLeaf')}
            name="adaptiveConfig.minQuestionsPerLeaf"
            min={placementPilot ? 4 : 1}
            max={1000}
            precision={0}
            className={{ root: 'min-w-0', label: 'min-w-0 whitespace-normal' }}
            data={{ cy: 'adaptive-min-questions-per-leaf' }}
          />
          <FormikNumberField
            id="adaptive-per-leaf-question-cap"
            label={t('maxPerLeaf')}
            name="adaptiveConfig.perLeafQuestionCap"
            min={1}
            max={1000}
            precision={0}
            className={{ root: 'min-w-0', label: 'min-w-0 whitespace-normal' }}
            data={{ cy: 'adaptive-per-leaf-question-cap' }}
          />
        </div>
      </details>
    </section>
  )
}
export default AdaptiveStoppingSettings
