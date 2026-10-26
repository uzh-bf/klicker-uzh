import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Markdown } from '@klicker-uzh/markdown'
import {
  H4,
  ShadcnCollapsible,
  ShadcnCollapsibleContent,
  ShadcnCollapsibleTrigger,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

interface ParticipantDataDisclosureProps {
  isAssessment?: boolean
}

function ParticipantDataDisclosure({
  isAssessment = process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true',
}: ParticipantDataDisclosureProps) {
  const t = useTranslations()
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})

  const sections = [
    {
      key: 'data-collection',
      title: 'dataCollectionTitle',
      notice: isAssessment
        ? 'assessmentDataCollectionNotice'
        : 'dataCollectionNotice',
    },
    {
      key: 'data-sharing',
      title: 'dataSharingTitle',
      notice: isAssessment
        ? 'assessmentDataSharingNotice'
        : 'dataSharingNotice',
    },
    {
      key: 'data-usage',
      title: 'dataUsageTitle',
      notice: isAssessment ? 'assessmentDataUsageNotice' : 'dataUsageNotice',
    },
    {
      key: 'data-storage',
      title: 'dataStorageTitle',
      notice: isAssessment
        ? 'assessmentDataStorageNotice'
        : 'dataStorageNotice',
    },
  ] as const

  return (
    <div>
      {sections.map((section) => {
        const open = openSections[section.key] ?? false
        return (
          <ShadcnCollapsible
            className="border-b border-slate-200"
            key={section.key}
            open={open}
            onOpenChange={() =>
              setOpenSections((current) => ({
                ...current,
                [section.key]: !open,
              }))
            }
          >
            <ShadcnCollapsibleTrigger
              className="flex w-full flex-row items-center justify-between gap-3 py-3 text-left"
              data-cy={`participant-data-disclosure-${section.key}`}
            >
              <H4 className={{ root: 'mb-0' }}>
                {t(`pwa.createAccount.signup.${section.title}`)}
              </H4>
              <FontAwesomeIcon
                aria-hidden="true"
                className="shrink-0 text-slate-500"
                icon={open ? faChevronUp : faChevronDown}
                size="sm"
              />
            </ShadcnCollapsibleTrigger>
            <ShadcnCollapsibleContent className="pb-3">
              <Markdown
                withProse
                withLinkButtons={false}
                className={{ root: 'prose-sm' }}
                content={t(`pwa.createAccount.signup.${section.notice}`)}
              />
            </ShadcnCollapsibleContent>
          </ShadcnCollapsible>
        )
      })}
    </div>
  )
}

export default ParticipantDataDisclosure
