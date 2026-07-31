import { LearningAnalyticsChoice } from '@klicker-uzh/graphql/dist/ops'
import {
  RadioGroup,
  RadioGroupItem,
  ShadcnLabel,
  UserNotification,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface LearningAnalyticsChoiceFieldProps {
  value: LearningAnalyticsChoice | ''
  onChange: (value: LearningAnalyticsChoice) => void
  error?: string
  idPrefix: string
}

function LearningAnalyticsChoiceField({
  value,
  onChange,
  error,
  idPrefix,
}: LearningAnalyticsChoiceFieldProps) {
  const t = useTranslations()

  return (
    <div className="space-y-3">
      <UserNotification
        type="info"
        message={t('pwa.learningAnalytics.explanation')}
      />
      <RadioGroup
        value={value}
        onValueChange={(choice) => onChange(choice as LearningAnalyticsChoice)}
        className="space-y-2"
        data-cy={`${idPrefix}-choice`}
      >
        <div className="flex items-start gap-3 rounded border border-slate-300 p-3">
          <RadioGroupItem
            value={LearningAnalyticsChoice.Included}
            id={`${idPrefix}-included`}
            data-cy={`${idPrefix}-included`}
          />
          <ShadcnLabel
            htmlFor={`${idPrefix}-included`}
            className="cursor-pointer font-normal"
          >
            <span className="block font-bold">
              {t('pwa.learningAnalytics.include')}
            </span>
            <span className="mt-1 block text-sm text-slate-600">
              {t('pwa.learningAnalytics.includeDescription')}
            </span>
          </ShadcnLabel>
        </div>
        <div className="flex items-start gap-3 rounded border border-slate-300 p-3">
          <RadioGroupItem
            value={LearningAnalyticsChoice.Excluded}
            id={`${idPrefix}-excluded`}
            data-cy={`${idPrefix}-excluded`}
          />
          <ShadcnLabel
            htmlFor={`${idPrefix}-excluded`}
            className="cursor-pointer font-normal"
          >
            <span className="block font-bold">
              {t('pwa.learningAnalytics.exclude')}
            </span>
            <span className="mt-1 block text-sm text-slate-600">
              {t('pwa.learningAnalytics.excludeDescription')}
            </span>
          </ShadcnLabel>
        </div>
      </RadioGroup>
      <p className="text-sm text-slate-600">
        {t('pwa.learningAnalytics.changeDisclaimer')}
      </p>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export default LearningAnalyticsChoiceField
