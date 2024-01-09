import { faGithub } from '@fortawesome/free-brands-svg-icons'
import {
  faComments,
  faEnvelope,
  faLightbulb,
} from '@fortawesome/free-regular-svg-icons'
import {
  faBook,
  faBug,
  faBullseye,
  faInfo,
  faList,
  faQuestion,
  faServer,
} from '@fortawesome/free-solid-svg-icons'
import { User } from '@klicker-uzh/graphql/dist/ops'
import { H2, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import SupportEntry from './SupportEntry'

interface SupportModalProps {
  open: boolean
  setOpen: (newOpen: boolean) => void
  user?: User | null
}

function SupportModal({ open, setOpen, user }: SupportModalProps) {
  const t = useTranslations()

  return (
    <Modal
      title={t('manage.support.modalTitle')}
      open={open}
      onClose={() => setOpen(false)}
      className={{
        overlay: 'text-black my-auto',
        title: 'text-xl md:text-2xl',
      }}
      fullScreen
    >
      <div className="flex flex-col flex-wrap gap-8 md:gap-16 md:flex-row">
        <div className="flex flex-col justify-between flex-1">
          <div className="order-2 md:order-1">
            <H2>{t('manage.support.yourFeedback')}</H2>
            <p className="mb-4 leading-6 prose">
              {t('manage.support.feedbackText')}
            </p>
            <div className="flex flex-col gap-2">
              <SupportEntry
                href="https://klicker-uzh.feedbear.com/boards/feature-requests"
                title={t('manage.support.featureRequest')}
                subtitle={t('manage.support.featureRequestDesc')}
                icon={faLightbulb}
                data={{ cy: 'support-feature-request' }}
              />
              <SupportEntry
                href="https://klicker-uzh.feedbear.com/boards/bug-reports"
                title={t('manage.support.bugReport')}
                subtitle={t('manage.support.bugReportDesc')}
                icon={faBug}
                data={{ cy: 'support-bug-report' }}
              />
              <SupportEntry
                href="https://klicker-uzh.feedbear.com/boards/self-hosting"
                title={t('manage.support.selfHosting')}
                subtitle={t('manage.support.selfHostingDesc')}
                icon={faServer}
                data={{ cy: 'support-self-hosting' }}
              />
            </div>
          </div>

          <div className="order-1 md:order-2 w-[200px] py-8 md:p-0 m-auto md:m-0">
            <Image
              src="/KlickerLogo.png"
              width={300}
              height={90}
              alt="KlickerUZH Logo"
              className="mx-auto"
              data-cy="login-logo"
            />
          </div>
        </div>

        <div className="flex flex-col justify-between flex-1">
          <div className="flex flex-col gap-2">
            <H2>{t('manage.support.furtherResources')}</H2>
            <div className="text-gray-600">
              {t('shared.generic.documentation')}
            </div>
            <SupportEntry
              href="https://www.klicker.uzh.ch/getting_started/welcome"
              title={t('shared.generic.documentation')}
              subtitle={t('manage.support.documentationDesc')}
              icon={faBook}
              data={{ cy: 'support-documentation' }}
            />
            <SupportEntry
              href="https://www.klicker.uzh.ch/faq"
              title={t('manage.support.faq')}
              subtitle={t('manage.support.faqDesc')}
              icon={faQuestion}
              data={{ cy: 'support-faq' }}
            />
            <div className="mt-4 text-gray-600">
              {t('manage.support.connect')}
            </div>
            <SupportEntry
              href="https://www.klicker.uzh.ch/community"
              title={t('manage.support.community')}
              subtitle={t('manage.support.communityDesc')}
              icon={faComments}
              data={{ cy: 'support-community' }}
            />
            {user?.catalyst ? (
              <SupportEntry
                href="mailto:klicker.support@uzh.ch"
                title={t('manage.support.email')}
                subtitle={t('manage.support.emailDesc')}
                icon={faEnvelope}
                data={{ cy: 'support-email' }}
              />
            ) : null}
            <div className="mt-4 text-gray-600">
              {t('manage.support.aboutProject')}
            </div>
            <SupportEntry
              href="https://community.klicker.uzh.ch/tag/project-update"
              title={t('manage.support.projectUpdates')}
              subtitle={t('manage.support.projectUpdatesDesc')}
              icon={faInfo}
              data={{ cy: 'support-project-updates' }}
            />
            <SupportEntry
              href="https://www.klicker.uzh.ch/development"
              title={t('manage.support.roadmap')}
              subtitle={t('manage.support.roadmapDesc')}
              icon={faBullseye}
              data={{ cy: 'support-roadmap' }}
            />
            <SupportEntry
              href="https://community.klicker.uzh.ch/tag/release"
              title={t('manage.support.releaseNotes')}
              subtitle={t('manage.support.releaseNotesDesc')}
              icon={faList}
              data={{ cy: 'support-release-notes' }}
            />
            <div className="mt-4 text-gray-600">
              {t('manage.support.openSource')}
            </div>
            <SupportEntry
              href="https://github.com/uzh-bf/klicker-uzh"
              title={t('manage.support.githubRepository')}
              subtitle={t('manage.support.githubRepositoryDesc')}
              icon={faGithub}
              data={{ cy: 'support-github-repository' }}
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default SupportModal
