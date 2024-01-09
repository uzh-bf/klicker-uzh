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
import Image from 'next/image'
import SupportEntry from './SupportEntry'

interface SupportModalProps {
  open: boolean
  setOpen: (newOpen: boolean) => void
  user?: User | null
}

function SupportModal({ open, setOpen, user }: SupportModalProps) {
  return (
    <Modal
      title="Support KlickerUZH"
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
            <H2>Your Feedback</H2>
            <p className="mb-2 prose prose-lg">
              Do you have any feedback for us? Are you experiencing issues when
              using the KlickerUZH? Please provide us with your feedback so we
              can continue to improve the KlickerUZH for you.
            </p>
            <div className="flex flex-col gap-2">
              <SupportEntry
                href="https://klicker-uzh.feedbear.com/boards/feature-requests"
                subtitle="I would like to request a new feature."
                title="Feature Request"
                icon={faLightbulb}
                data={{ cy: 'support-feature-request' }}
              />
              <SupportEntry
                href="https://klicker-uzh.feedbear.com/boards/bug-reports"
                subtitle="I would like to report a bug or issue."
                title="Bug Report"
                icon={faBug}
                data={{ cy: 'support-bug-report' }}
              />
              <SupportEntry
                href="https://klicker-uzh.feedbear.com/boards/self-hosting"
                subtitle="I have problems when self-hosting the KlickerUZH."
                title="Self-Hosting"
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
            <H2>Further Resources</H2>
            <div className="text-gray-600">Documentation</div>
            <SupportEntry
              href="https://www.klicker.uzh.ch/getting_started/welcome"
              icon={faBook}
              subtitle="Tutorials, feature documentation, and release notes"
              title="Documentation"
              data={{ cy: 'support-documentation' }}
            />
            <SupportEntry
              href="https://www.klicker.uzh.ch/faq"
              icon={faQuestion}
              subtitle="Frequently asked questions"
              title="FAQ"
              data={{ cy: 'support-faq' }}
            />
            <div className="mt-4 text-gray-600">Connect with Us</div>
            <SupportEntry
              href="https://www.klicker.uzh.ch/community"
              icon={faComments}
              subtitle="A place for discussions and questions regarding the KlickerUZH"
              title="Community"
              data={{ cy: 'support-community' }}
            />
            {user?.catalyst ? (
              <SupportEntry
                href="mailto:klicker.support@uzh.ch"
                icon={faEnvelope}
                subtitle="Contact us at klicker.support@uzh.ch"
                title="Email"
                data={{ cy: 'support-email' }}
              />
            ) : null}
            <div className="mt-4 text-gray-600">About the Project</div>
            <SupportEntry
              href="https://community.klicker.uzh.ch/tag/project-update"
              icon={faInfo}
              subtitle="Regular updates regarding the progress of our project"
              title="Project Updates"
              data={{ cy: 'support-project-updates' }}
            />
            <SupportEntry
              href="https://www.klicker.uzh.ch/development"
              icon={faBullseye}
              subtitle="Our current priorities and plans for the future"
              title="Roadmap"
              data={{ cy: 'support-roadmap' }}
            />
            <SupportEntry
              href="https://community.klicker.uzh.ch/tag/release"
              icon={faList}
              subtitle="Overview of changes in our latest releases"
              title="Release Notes"
              data={{ cy: 'support-release-notes' }}
            />
            <div className="mt-4 text-gray-600">Open-Source</div>
            <SupportEntry
              href="https://github.com/uzh-bf/klicker-uzh"
              icon={faGithub}
              subtitle="Source code of the open-source project"
              title="Github Repository"
              data={{ cy: 'support-github-repository' }}
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default SupportModal
