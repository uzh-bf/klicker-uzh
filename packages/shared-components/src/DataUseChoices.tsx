import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Button,
  Collapsible,
  H4,
  RadioGroup,
  RadioGroupItem,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

export interface DataUseChoicesProps {
  id: string
  researchAllowed: boolean
  learningAnalytics: boolean | undefined
  onResearchChange: (value: boolean) => void
  onLearningAnalyticsChange: (value: boolean) => void
}

export default function DataUseChoices({
  id,
  researchAllowed,
  learningAnalytics,
  onResearchChange,
  onLearningAnalyticsChange,
}: DataUseChoicesProps) {
  const t = useTranslations()
  const [researchOpen, setResearchOpen] = useState(false)
  const [analyticsOpen, setAnalyticsOpen] = useState(true)

  return (
    <div className="space-y-2">
      <Collapsible
        data={{ cy: `${id}-research-details` }}
        open={researchOpen}
        onChange={() => setResearchOpen(!researchOpen)}
        customTrigger={
          <>
            <FontAwesomeIcon
              icon={researchOpen ? faChevronUp : faChevronDown}
              size="sm"
            />
            <span className="sr-only">{t('dpoDraft.choices.research')}</span>
          </>
        }
        staticContent={
          <>
            <H4>{t('dpoDraft.choices.research')}</H4>
            <p className="text-sm">
              {t(
                researchAllowed
                  ? 'dpoDraft.choices.allowed'
                  : 'dpoDraft.choices.objected'
              )}
            </p>
          </>
        }
      >
        <p className="my-2 text-sm leading-relaxed">
          {t('dpoDraft.choices.researchDescription')}
        </p>
        <fieldset
          className="flex flex-wrap gap-2"
          aria-label={t('dpoDraft.choices.research')}
        >
          {[true, false].map((value) => (
            <Button
              key={String(value)}
              type="button"
              data={{ cy: `${id}-research-${value ? 'allow' : 'object'}` }}
              primary={researchAllowed === value}
              aria-pressed={researchAllowed === value}
              onClick={() => onResearchChange(value)}
            >
              {t(value ? 'dpoDraft.choices.allow' : 'dpoDraft.choices.object')}
            </Button>
          ))}
        </fieldset>
      </Collapsible>
      <Collapsible
        data={{ cy: `${id}-analytics-details` }}
        open={analyticsOpen}
        onChange={() => setAnalyticsOpen(!analyticsOpen)}
        customTrigger={
          <>
            <FontAwesomeIcon
              icon={analyticsOpen ? faChevronUp : faChevronDown}
              size="sm"
            />
            <span className="sr-only">{t('dpoDraft.choices.analytics')}</span>
          </>
        }
        staticContent={
          <>
            <H4>{t('dpoDraft.choices.analytics')}</H4>
            <p className="text-sm">
              {learningAnalytics === undefined
                ? t('dpoDraft.choices.required')
                : t(
                    learningAnalytics
                      ? 'dpoDraft.choices.enabled'
                      : 'dpoDraft.choices.disabled'
                  )}
            </p>
          </>
        }
      >
        <p className="my-2 text-sm leading-relaxed">
          {t('dpoDraft.choices.analyticsDescription')}{' '}
          <a
            data-cy={`${id}-guide`}
            className="text-uzh-blue-100 underline"
            href="/api/dpo-draft-assets/guide"
          >
            {t('dpoDraft.choices.guide')}
          </a>
        </p>
        <RadioGroup
          aria-label={t('dpoDraft.choices.analytics')}
          value={
            learningAnalytics === undefined ? '' : String(learningAnalytics)
          }
          onValueChange={(value) => onLearningAnalyticsChange(value === 'true')}
          className="grid gap-2 sm:grid-cols-2"
        >
          {[true, false].map((value) => (
            <label
              key={String(value)}
              htmlFor={`${id}-la-${value}`}
              className="flex cursor-pointer items-start gap-2 rounded border p-2"
            >
              <RadioGroupItem
                id={`${id}-la-${value}`}
                value={String(value)}
                data-cy={`${id}-la-${value}`}
                className="mt-1 shrink-0"
              />
              <span>
                <b>
                  {t(value ? 'dpoDraft.choices.yes' : 'dpoDraft.choices.no')}
                </b>
                <span className="block text-sm">
                  {t(
                    value
                      ? 'dpoDraft.choices.yesDescription'
                      : 'dpoDraft.choices.noDescription'
                  )}
                </span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </Collapsible>
    </div>
  )
}
