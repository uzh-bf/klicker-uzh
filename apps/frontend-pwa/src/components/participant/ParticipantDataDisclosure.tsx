import { Markdown } from '@klicker-uzh/markdown'
import { Collapsible, H4 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

interface ParticipantDataDisclosureProps {
  isAssessment?: boolean
}

function ParticipantDataDisclosure({
  isAssessment = process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true',
}: ParticipantDataDisclosureProps) {
  const t = useTranslations()
  const [openSection, setOpenSection] = useState<number | null>(null)

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
    <div className="space-y-2">
      {sections.map((section, index) => (
        <Collapsible
          key={section.key}
          data={{ cy: `participant-data-disclosure-${section.key}` }}
          customTrigger={
            <>
              <span className="sr-only">
                {t(`pwa.createAccount.signup.${section.title}`)}
              </span>
              <span aria-hidden="true">
                {openSection === index ? '⌃' : '⌄'}
              </span>
            </>
          }
          open={openSection === index}
          onChange={() =>
            setOpenSection((current) => (current === index ? null : index))
          }
          staticContent={
            <H4>{t(`pwa.createAccount.signup.${section.title}`)}</H4>
          }
        >
          <Markdown
            withProse
            withLinkButtons={false}
            className={{ root: 'prose-sm' }}
            content={t(`pwa.createAccount.signup.${section.notice}`)}
          />
        </Collapsible>
      ))}
    </div>
  )
}

export default ParticipantDataDisclosure
