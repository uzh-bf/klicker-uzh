import { faGithub } from '@fortawesome/free-brands-svg-icons'
import { faCrown } from '@fortawesome/free-solid-svg-icons'
import {
  faComment,
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
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  QGetCatalystRequestAccessDocument,
  User,
  UserLoginScope,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, Modal } from '@uzh-bf/design-system'
import { useQuery } from '@apollo/client'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useState } from 'react'
import CatalystRequestForm from './CatalystRequestForm'
import SupportEntry from './SupportEntry'

function SupportModal({
  onClose,
  user,
}: {
  onClose: () => void
  user?: User | null
}) {
  const t = useTranslations()
  const [showRequestPanel, setShowRequestPanel] = useState(false)

  const { data: scopeData } = useQuery(QGetCatalystRequestAccessDocument)

  const isAccountOwner = scopeData?.userScope === UserLoginScope.AccountOwner

  return (
    <Modal
      open
      fullScreen
      title={t('manage.support.modalTitle')}
      onClose={onClose}
      className={{
        overlay: 'my-auto text-black',
        title: 'text-left text-xl md:text-2xl',
        content: 'h-max pb-1',
      }}
    >
      <div className="flex flex-col flex-wrap gap-8 md:flex-row md:gap-16">
        <div className="flex flex-1 flex-col justify-between">
          <div className="order-2 md:order-1">
            <H2>{t('manage.support.yourFeedback')}</H2>
            <p className="prose mb-4 leading-6">
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

          <div className="order-1 m-auto w-[200px] py-8 md:order-2 md:m-0 md:p-0">
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

        <div className="flex flex-1 flex-col justify-between">
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
              icon={faComment}
              data={{ cy: 'support-community' }}
            />
            {user?.catalyst ? (
              <SupportEntry
                href="mailto:klicker@df.uzh.ch"
                title={t('manage.support.email')}
                subtitle={t('manage.support.emailDesc')}
                icon={faEnvelope}
                data={{ cy: 'support-email' }}
              />
            ) : isAccountOwner ? (
              <div className="flex flex-col gap-2">
                {!showRequestPanel ? (
                  <Button
                    variant="default"
                    onClick={() => setShowRequestPanel(true)}
                    data={{ cy: 'support-catalyst-request' }}
                  >
                    <div className="flex flex-row items-center gap-2">
                      <FontAwesomeIcon
                        icon={faCrown}
                        className="text-orange-400"
                      />
                      <div>
                        <div className="font-bold">
                          {t('manage.support.catalystRequest.title')}
                        </div>
                        <div className="text-sm font-normal">
                          {t('manage.support.catalystRequest.subtitle')}
                        </div>
                      </div>
                    </div>
                  </Button>
                ) : (
                  <div className="flex flex-col gap-3 rounded-lg border border-solid border-gray-300 p-4">
                    <CatalystRequestForm
                      onSuccess={() => {
                        setShowRequestPanel(false)
                        onClose()
                      }}
                    />
                  </div>
                )}
              </div>
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
