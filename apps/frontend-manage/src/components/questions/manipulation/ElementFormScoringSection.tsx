import { faBookOpen } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { FormLabel, Switch } from '@uzh-bf/design-system'
import { FormikErrors } from 'formik'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import MultiplierSelector from './../../activities/creation/MultiplierSelector'
import SampleSolutionSetting from './options/SampleSolutionSetting'
import { ElementFormTypes } from './types'

function ElementformScoringSection({
  isTemplate,
  values,
  setFieldValue,
  isSubmitting,
}: {
  isTemplate: boolean
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
            label={t('manage.elementForms.sampleSolutionAndScoring')}
            labelType="small"
            className={{ label: 'my-1 !text-lg' }}
          />
          <Link
            href={'https://www.klicker.uzh.ch/gamification/grading_logic/'}
            passHref
            legacyBehavior
          >
            <a
              className="text-primary-100 flex flex-row items-center gap-2 text-sm hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FontAwesomeIcon icon={faBookOpen} />
              {t('manage.elementForms.scoringDocumentation')}
            </a>
          </Link>
        </div>

        <SampleSolutionSetting disabled={isTemplate} type={values.type} />
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
              {t('manage.elementForms.basePointInformation')}
            </div>
          </div>
          <Switch
            checked={values.basePoints}
            onCheckedChange={() =>
              setFieldValue('basePoints', !values.basePoints)
            }
            disabled={isSubmitting}
            className={{
              root: 'mt-2 self-center',
            }}
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
                {t('manage.elementForms.multiplierInformation')}
              </div>
              <MultiplierSelector
                withoutLabel
                name="pointsMultiplier"
                disabled={isSubmitting}
                className={{
                  trigger: 'mt-1 h-8 w-full',
                }}
              />
            </div>
          ) : (
            <div className="text-sm">
              {t('manage.elementForms.multiplierNoEffect')}
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
                  ? t('manage.elementForms.liveQuizBasePoints')
                  : t('manage.elementForms.zeroPoints')}
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
                  : t('manage.elementForms.zeroPoints')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ElementformScoringSection
