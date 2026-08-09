import { faBookOpen } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { FormLabel, Switch } from '@uzh-bf/design-system'
import { FormikErrors } from 'formik'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import MultiplierSelector from '../../activities/creation/MultiplierSelector'
import SampleSolutionSetting from './options/SampleSolutionSetting'
import { ElementFormTypes } from './types'

function ElementformScoringSection({
  isTemplate,
  disabled,
  values,
  setFieldValue,
  isSubmitting,
}: {
  isTemplate: boolean
  disabled: boolean
  values: ElementFormTypes
  setFieldValue: (
    field: string,
    value: any,
    shouldValidate?: boolean
  ) => Promise<void | FormikErrors<ElementFormTypes>>
  isSubmitting: boolean
}) {
  const t = useTranslations()

  return (
    <div className="mt-4 border-y-4 pb-3 pt-2">
      <div>
        <div className="flex flex-row items-center gap-5">
          <FormLabel
            required={false}
            label={t('manage.elements.sampleSolutionAndScoring')}
            labelType="small"
            className={{ label: 'text-lg! my-1' }}
          />
          <Link
            href={'https://www.klicker.uzh.ch/gamification/grading_logic/'}
            className="text-primary-100 flex flex-row items-center gap-2 text-sm hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FontAwesomeIcon icon={faBookOpen} />
            {t('manage.elements.scoringDocumentation')}
          </Link>
        </div>

        <SampleSolutionSetting
          disabled={isTemplate || disabled}
          type={values.type}
        />
      </div>

      <div className="mt-2 flex flex-col lg:flex-row lg:gap-4">
        {/* Column 1: Base Points */}
        <div className="mb-3 flex flex-1 flex-col lg:mb-0">
          <FormLabel
            required
            labelType="small"
            label={t('shared.generic.basePoints')}
            className={{
              label: 'my-0',
            }}
          />
          <div className="flex flex-row gap-2">
            <div className="text-sm">
              {t('manage.elements.basePointInformation')}
            </div>
          </div>
          <Switch
            disabled={isSubmitting || disabled}
            checked={values.basePoints}
            onCheckedChange={() =>
              setFieldValue('basePoints', !values.basePoints)
            }
            className={{ root: 'mt-2 self-center' }}
            data={{ cy: 'configure-base-points' }}
          />
        </div>

        {/* Separator */}
        <div className="my-2 hidden w-px bg-gray-300 lg:block"></div>

        {/* Column 2: Multiplier */}
        <div className="mb-3 flex-1 lg:mb-0">
          <FormLabel
            required
            labelType="small"
            label={t('shared.generic.multiplier')}
            className={{
              label: 'my-0',
            }}
          />
          {'options' in values &&
          'hasSampleSolution' in values.options &&
          values.options.hasSampleSolution ? (
            <div className="flex flex-col items-center gap-1">
              <div className="text-sm">
                {t('manage.elements.multiplierInformation')}
              </div>
              <MultiplierSelector
                withoutLabel
                name="pointsMultiplier"
                disabled={isSubmitting || disabled}
                className={{
                  trigger: 'mt-1 h-8 w-full',
                }}
              />
            </div>
          ) : (
            <div className="text-sm">
              {t('manage.elements.multiplierNoEffect')}
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="my-2 hidden w-px bg-gray-300 lg:block"></div>

        {/* Column 3: Summary */}
        <div className="flex-1">
          <FormLabel
            required
            labelType="small"
            label={t('shared.generic.awardedPoints')}
            className={{
              label: 'my-0',
            }}
          />
          <div className="flex flex-col space-y-1">
            <div className="text-sm">
              <span className="mr-1 font-bold">
                {t('shared.generic.basePoints')}:
              </span>
              <span>
                {values.basePoints
                  ? t('manage.elements.liveQuizBasePoints')
                  : t('manage.elements.zeroPoints')}
              </span>
            </div>
            <div className="text-sm">
              <div className="mr-1 font-bold">
                {t('shared.generic.additionalPoints')}:
              </div>
              <span>
                {'options' in values &&
                'hasSampleSolution' in values.options &&
                values.options.hasSampleSolution
                  ? `${values.pointsMultiplier} * (${t('shared.generic.correctnessPoints')} + ${t('shared.generic.bonusPoints')})`
                  : t('manage.elements.zeroPoints')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ElementformScoringSection
