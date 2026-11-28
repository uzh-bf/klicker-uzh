'use client'

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
  H4,
  RadioGroup,
  RadioGroupItem,
  ShadcnCollapsible,
  ShadcnCollapsibleContent,
  ShadcnCollapsibleTrigger,
  ShadcnLabel,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface TutorPersonalizationChoiceProps {
  consent: boolean | null
  disabled?: boolean
  defaultOpen?: boolean
  onChange: (consent: boolean) => void
  dataCy: { toggle: string; yes: string; no: string }
}

function consentToRadioValue(consent: boolean | null): '' | 'yes' | 'no' {
  if (consent === null) return ''
  return consent ? 'yes' : 'no'
}

function TutorPersonalizationChoice({
  consent,
  disabled,
  defaultOpen = false,
  onChange,
  dataCy,
}: TutorPersonalizationChoiceProps) {
  const t = useTranslations()
  const [open, setOpen] = useState(defaultOpen)

  const badge = {
    '': {
      variant: 'outline' as const,
      label: t('shared.tutorPersonalization.badgeUnanswered'),
    },
    yes: {
      variant: 'default' as const,
      label: t('shared.tutorPersonalization.badgeOn'),
    },
    no: {
      variant: 'secondary' as const,
      label: t('shared.tutorPersonalization.badgeOff'),
    },
  }[consentToRadioValue(consent)]

  // both options share one layout so neither answer is visually favoured
  const options = [
    {
      value: 'yes',
      id: 'tutor-personalization-consent-yes',
      cy: dataCy.yes,
      icon: faCheck,
      label: t('shared.tutorPersonalization.yes'),
    },
    {
      value: 'no',
      id: 'tutor-personalization-consent-no',
      cy: dataCy.no,
      icon: faXmark,
      label: t('shared.tutorPersonalization.no'),
    },
  ]

  return (
    <ShadcnCollapsible
      className="border-b border-slate-200"
      open={open}
      onOpenChange={() => setOpen((current) => !current)}
    >
      <ShadcnCollapsibleTrigger
        className="flex w-full flex-row items-center justify-between gap-3 py-3 text-left"
        data-cy={dataCy.toggle}
      >
        <div className="flex flex-1 items-center justify-between gap-2">
          <H4 className={{ root: 'mb-0' }}>
            {t('shared.tutorPersonalization.title')}
          </H4>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
        <FontAwesomeIcon
          aria-hidden="true"
          className="shrink-0 text-slate-500"
          icon={open ? faChevronUp : faChevronDown}
          size="sm"
        />
      </ShadcnCollapsibleTrigger>
      <ShadcnCollapsibleContent className="pb-3">
        <div className="pb-2">
          <Markdown
            withProse
            withLinkButtons={false}
            className={{ root: 'prose-sm' }}
            content={t('shared.tutorPersonalization.notice')}
          />
          <p className="mt-3 text-sm font-medium">
            {t('shared.tutorPersonalization.controlLabel')}
          </p>
          <RadioGroup
            aria-label={t('shared.tutorPersonalization.title')}
            className="mt-1 gap-2 sm:grid-cols-2"
            disabled={disabled}
            value={consentToRadioValue(consent)}
            onValueChange={(value) => {
              if (value === 'yes' || value === 'no') {
                onChange(value === 'yes')
              }
            }}
          >
            {options.map((option) => (
              <ShadcnLabel
                key={option.value}
                htmlFor={option.id}
                className={twMerge(
                  'flex cursor-pointer items-center justify-center gap-2 rounded border p-2 font-normal',
                  consent === (option.value === 'yes')
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
      </ShadcnCollapsibleContent>
    </ShadcnCollapsible>
  )
}

export default TutorPersonalizationChoice
