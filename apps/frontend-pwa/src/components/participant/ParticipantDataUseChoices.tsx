import {
  faCheck,
  faChevronDown,
  faChevronUp,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Markdown } from '@klicker-uzh/markdown'
import {
  Badge,
  Collapsible,
  H4,
  RadioGroup,
  RadioGroupItem,
  ShadcnLabel,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface ParticipantDataUseChoicesDataCy {
  researchYes: string
  researchNo: string
  researchToggle: string
  learningAnalyticsYes: string
  learningAnalyticsNo: string
  learningAnalyticsToggle: string
  learningAnalyticsPrivacy: string
}

interface ParticipantDataUseChoicesProps {
  isAssessment?: boolean
  disabled?: boolean
  researchConsent?: boolean
  learningAnalyticsConsent?: boolean
  onResearchConsentChange: (consent: boolean) => void
  onLearningAnalyticsConsentChange: (consent: boolean) => void
  dataCy: ParticipantDataUseChoicesDataCy
}

function ParticipantDataUseChoices({
  isAssessment = process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true',
  disabled,
  researchConsent,
  learningAnalyticsConsent,
  onResearchConsentChange,
  onLearningAnalyticsConsentChange,
  dataCy,
}: ParticipantDataUseChoicesProps) {
  const t = useTranslations()
  const [researchOpen, setResearchOpen] = useState(false)
  const [learningAnalyticsOpen, setLearningAnalyticsOpen] = useState(true)

  // the collapsed research section always shows the currently recorded choice
  const researchBadge =
    researchConsent === undefined
      ? {
          variant: 'outline' as const,
          label: t('pwa.createAccount.signup.researchConsentBadgeUnanswered'),
        }
      : researchConsent
        ? {
            variant: 'default' as const,
            label: t('pwa.createAccount.signup.researchConsentBadgeAllowed'),
          }
        : {
            variant: 'secondary' as const,
            label: t('pwa.createAccount.signup.researchConsentBadgeRefused'),
          }

  const researchOptions = [
    {
      value: 'yes',
      id: 'research-consent-yes',
      cy: dataCy.researchYes,
      icon: faCheck,
      label: t('pwa.createAccount.signup.researchConsentYes'),
    },
    {
      value: 'no',
      id: 'research-consent-no',
      cy: dataCy.researchNo,
      icon: faXmark,
      label: t('pwa.createAccount.signup.researchConsentNo'),
    },
  ]

  const learningAnalyticsOptions = [
    {
      value: 'yes',
      id: 'learning-analytics-consent-yes',
      cy: dataCy.learningAnalyticsYes,
      label: t('pwa.createAccount.signup.learningAnalyticsConsentYes'),
      description: t(
        'pwa.createAccount.signup.learningAnalyticsConsentYesDescription'
      ),
    },
    {
      value: 'no',
      id: 'learning-analytics-consent-no',
      cy: dataCy.learningAnalyticsNo,
      label: t('pwa.createAccount.signup.learningAnalyticsConsentNo'),
      description: t(
        'pwa.createAccount.signup.learningAnalyticsConsentNoDescription'
      ),
    },
  ]

  return (
    <div className="space-y-2">
      <Collapsible
        className={{
          root: 'relative rounded-none border-0 border-b border-slate-200 p-3',
          staticContent: 'pr-9',
          content: 'pb-3 pt-2',
          bottomWrapper: 'absolute right-2 top-2 mb-0 flex w-8',
          trigger:
            'h-8 items-center justify-center rounded text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2',
          primary: 'hidden',
          secondary: 'hidden',
        }}
        data={{ cy: dataCy.researchToggle }}
        open={researchOpen}
        onChange={() => setResearchOpen((current) => !current)}
        staticContent={
          <div className="flex items-center justify-between gap-2">
            <H4 className={{ root: 'mb-0' }}>
              {t('pwa.createAccount.signup.researchConsentTitle')}
            </H4>
            <Badge variant={researchBadge.variant}>{researchBadge.label}</Badge>
          </div>
        }
        customTrigger={
          <>
            <span className="sr-only">
              {t('pwa.createAccount.signup.researchConsentTitle')}
            </span>
            <span aria-hidden="true">
              <FontAwesomeIcon
                icon={researchOpen ? faChevronUp : faChevronDown}
                size="sm"
              />
            </span>
          </>
        }
      >
        <div className="pb-2">
          <Markdown
            withProse
            withLinkButtons={false}
            className={{ root: 'prose-sm' }}
            content={t(
              isAssessment
                ? 'pwa.createAccount.signup.researchConsentDescriptionAssessment'
                : 'pwa.createAccount.signup.researchConsentDescription'
            )}
          />
          <p className="mt-3 text-sm font-medium">
            {t('pwa.createAccount.signup.researchConsentControlLabel')}
          </p>
          <RadioGroup
            aria-label={t('pwa.createAccount.signup.researchConsentTitle')}
            aria-required="true"
            className="mt-1 grid-cols-2 gap-2"
            disabled={disabled}
            value={
              researchConsent === undefined
                ? ''
                : researchConsent
                  ? 'yes'
                  : 'no'
            }
            onValueChange={(value) => {
              if (value === 'yes' || value === 'no') {
                onResearchConsentChange(value === 'yes')
              }
            }}
          >
            {researchOptions.map((option) => (
              <ShadcnLabel
                key={option.value}
                htmlFor={option.id}
                className={twMerge(
                  'flex cursor-pointer items-center justify-center gap-2 rounded border p-2 font-normal',
                  researchConsent === (option.value === 'yes')
                    ? 'border-primary-100 bg-slate-50'
                    : 'border-slate-300'
                )}
              >
                <RadioGroupItem
                  value={option.value}
                  id={option.id}
                  data-cy={option.cy}
                />
                <FontAwesomeIcon icon={option.icon} size="sm" />
                <span>{option.label}</span>
              </ShadcnLabel>
            ))}
          </RadioGroup>
        </div>
      </Collapsible>

      <Collapsible
        className={{
          root: 'relative rounded-none border-0 border-b border-slate-200 p-3',
          staticContent: 'pr-9',
          content: 'pb-3 pt-2',
          bottomWrapper: 'absolute right-2 top-2 mb-0 flex w-8',
          trigger:
            'h-8 items-center justify-center rounded text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2',
          primary: 'hidden',
          secondary: 'hidden',
        }}
        data={{ cy: dataCy.learningAnalyticsToggle }}
        open={learningAnalyticsOpen}
        onChange={() => setLearningAnalyticsOpen((current) => !current)}
        staticContent={
          <div className="flex items-center justify-between gap-2">
            <H4 className={{ root: 'mb-0' }}>
              {t('pwa.createAccount.signup.learningAnalyticsConsentTitle')}
            </H4>
            {learningAnalyticsConsent === undefined && (
              <Badge variant="outline">
                {t(
                  'pwa.createAccount.signup.learningAnalyticsDecisionRequired'
                )}
              </Badge>
            )}
          </div>
        }
        customTrigger={
          <>
            <span className="sr-only">
              {t('pwa.createAccount.signup.learningAnalyticsConsentTitle')}
            </span>
            <span aria-hidden="true">
              <FontAwesomeIcon
                icon={learningAnalyticsOpen ? faChevronUp : faChevronDown}
                size="sm"
              />
            </span>
          </>
        }
      >
        <div className="pb-2">
          <Markdown
            withProse
            withLinkButtons={false}
            className={{ root: 'prose-sm' }}
            data={{ cy: dataCy.learningAnalyticsPrivacy }}
            content={t(
              'pwa.createAccount.signup.learningAnalyticsConsentDescription'
            )}
          />
          <RadioGroup
            aria-label={t(
              'pwa.createAccount.signup.learningAnalyticsConsentTitle'
            )}
            aria-required="true"
            className="mt-2 gap-2 sm:grid-cols-2"
            disabled={disabled}
            value={
              learningAnalyticsConsent === undefined
                ? ''
                : learningAnalyticsConsent
                  ? 'yes'
                  : 'no'
            }
            onValueChange={(value) => {
              if (value === 'yes' || value === 'no') {
                onLearningAnalyticsConsentChange(value === 'yes')
              }
            }}
          >
            {learningAnalyticsOptions.map((option) => (
              <ShadcnLabel
                key={option.value}
                htmlFor={option.id}
                className={twMerge(
                  'flex cursor-pointer items-start gap-3 rounded border p-3 font-normal',
                  learningAnalyticsConsent === (option.value === 'yes')
                    ? 'border-primary-100 bg-slate-50'
                    : 'border-slate-300'
                )}
              >
                <RadioGroupItem
                  value={option.value}
                  id={option.id}
                  data-cy={option.cy}
                  className="mt-1"
                />
                <span className="flex flex-col gap-1">
                  <span className="font-semibold">{option.label}</span>
                  <span className="text-sm text-slate-600">
                    {option.description}
                  </span>
                </span>
              </ShadcnLabel>
            ))}
          </RadioGroup>
        </div>
      </Collapsible>
    </div>
  )
}

export default ParticipantDataUseChoices
