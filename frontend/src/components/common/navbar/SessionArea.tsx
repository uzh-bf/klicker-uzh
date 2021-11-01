/* eslint-disable react/prop-types, react/no-array-index-key */

import * as React from 'react'
import { Button, Icon, Menu, Modal } from 'semantic-ui-react'
import Image from 'next/image'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import KlickerLogoSrc from '../../../../public/KlickerUZH_Gray_Transparent.png'
import SupportEntry from './SupportEntry'

const messages = defineMessages({
  support: {
    defaultMessage: 'Support',
    id: 'sessionArea.support',
  },
  whatsNew: {
    defaultMessage: 'Updates',
    id: 'sessionArea.whatsNew',
  },
})

interface Props {
  sessionId?: string
}

const defaultProps = {
  sessionId: undefined,
}

function SessionArea({ sessionId }: Props): React.ReactElement {
  const intl = useIntl()
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <Menu.Item>
        <Button
          icon
          as="a"
          color={sessionId ? 'green' : undefined}
          disabled={!sessionId}
          href="/sessions/running"
          labelPosition="left"
        >
          <Icon name="play" />
          <FormattedMessage defaultMessage="Running Session" id="sessionArea.toRunningSession" />
        </Button>
      </Menu.Item>

      <Modal
        open={open}
        size="fullscreen"
        trigger={<Menu.Item content={intl.formatMessage(messages.support)} icon="help" />}
        // width={200}
        onClose={() => setOpen(false)}
        onOpen={() => setOpen(true)}
      >
        <Modal.Content>
          <div className="flex flex-col flex-wrap gap-8 md:gap-16 md:flex-row">
            <div className="flex flex-col justify-between flex-1">
              <div className="order-2 md:order-1">
                <h2>Your Feedback</h2>
                <p className="prose prose-lg">
                  Do you have any feedback for us? Are you experiencing issues when using the KlickerUZH? Please provide
                  us with your feedback on our public roadmap so we can work to improve the KlickerUZH for you.
                </p>
                <div className="flex flex-col gap-2">
                  <SupportEntry
                    href="https://klicker-uzh.feedbear.com/boards/feature-requests"
                    subtitle="I would like to request a new feature."
                    title="Feature Request"
                  />
                  <SupportEntry
                    href="https://klicker-uzh.feedbear.com/boards/bug-reports"
                    subtitle="I would like to report a bug or issue."
                    title="Bug Report"
                  />
                  <SupportEntry
                    href="https://klicker-uzh.feedbear.com/boards/self-hosting"
                    subtitle="I have problems when self-hosting the KlickerUZH."
                    title="Self-Hosting"
                  />
                </div>
              </div>

              <div className="order-1 md:order-2 w-[200px] py-8 md:p-0 m-auto md:m-0">
                <Image alt="KlickerUZH Logo" src={KlickerLogoSrc} />
              </div>
            </div>

            <div className="flex flex-col justify-between flex-1">
              <div className="flex flex-col gap-2">
                <h2>Further Resources</h2>
                <div className="font-bold text-gray-600">Documentation</div>
                <SupportEntry
                  href="https://www.klicker.uzh.ch/docs/introduction/getting_started"
                  icon="book"
                  subtitle="Tutorials, feature documentation, and release notes"
                  title="Documentation"
                />
                <SupportEntry
                  href="https://www.klicker.uzh.ch/docs/faq/faq"
                  icon="question"
                  subtitle="Frequently asked questions"
                  title="FAQ"
                />
                <div className="mt-4 font-bold text-gray-600">Connect with Us</div>
                <SupportEntry
                  href="mailto:klicker.support@uzh.ch"
                  icon="mail outline"
                  subtitle="Contact us at klicker.support@uzh.ch"
                  title="Email"
                />
                <SupportEntry
                  href="https://github.com/uzh-bf/klicker-uzh/discussions"
                  icon="talk"
                  subtitle="A place for discussions and questions regarding the KlickerUZH"
                  title="Community"
                />
                <div className="mt-4 font-bold text-gray-600">About the Project</div>
                <SupportEntry
                  href="https://www.klicker.uzh.ch/docs/blog"
                  icon="info"
                  subtitle="Regular updates regarding the progress of our project"
                  title="Project Updates"
                />
                <SupportEntry
                  href="https://www.klicker.uzh.ch/roadmap"
                  icon="target"
                  subtitle="Our current priorities and plans for the future"
                  title="Roadmap"
                />
                <SupportEntry
                  href="https://klicker-uzh.feedbear.com/updates"
                  icon="list"
                  subtitle="Overview of changes in our latest releases"
                  title="Release Notes"
                />
                <div className="mt-4 font-bold text-gray-600">Open-Source</div>
                <SupportEntry
                  href="https://github.com/uzh-bf/klicker-uzh"
                  icon="github"
                  subtitle="Source code of the open-source project"
                  title="Github Repository"
                />
              </div>
            </div>
          </div>
        </Modal.Content>
      </Modal>

      <style jsx>{`
        h3 {
          font-size: 1.2rem;
        }

        h4 {
          font-size: 1rem;
          margin: 0;
        }

        .popupContent {
          padding: 0;

          :global(.button) {
            width: 100%;
            margin-bottom: 0.5rem;
          }
        }

        .popupHelp {
          width: 20rem;
        }

        .popupChanges {
          overflow: auto;
          max-height: 40rem;
          width: 35rem;
        }
      `}</style>
    </>
  )
}

SessionArea.defaultProps = defaultProps

export default SessionArea
