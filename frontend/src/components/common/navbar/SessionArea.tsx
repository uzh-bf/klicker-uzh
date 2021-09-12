/* eslint-disable react/prop-types, react/no-array-index-key */

import * as React from 'react'
import { Button, Icon, Menu, Popup, Modal, Header } from 'semantic-ui-react'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'

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
          <div className="flex flex-row flex-wrap">
            <div className="flex flex-col flex-1 md:pr-4">
              <div className="p-4 border border-solid rounded-lg hover:bg-gray-200 hover:cursor-pointer">
                <a
                  href="https://uzh-bf.github.io/klicker-uzh/docs/introduction/getting_started"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Header size="small">
                    <Icon name="book" />
                    <Header.Content>
                      Documentation
                      <Header.Subheader>User Manual, Feature Overview, etc.</Header.Subheader>
                    </Header.Content>
                  </Header>
                </a>
              </div>
              <div className="p-4 mt-2 border border-solid rounded-lg hover:bg-gray-200 hover:cursor-pointer">
                <a href="https://uzh-bf.github.io/klicker-uzh/docs/faq/faq" rel="noopener noreferrer" target="_blank">
                  <Header size="small">
                    <Icon name="question" />

                    <Header.Content>
                      FAQ
                      <Header.Subheader>Frequently Asked Questions</Header.Subheader>
                    </Header.Content>
                  </Header>
                </a>
              </div>
              <div className="p-4 mt-2 border border-solid rounded-lg hover:bg-gray-200 hover:cursor-pointer">
                <a href="https://github.com/uzh-bf/klicker-uzh" rel="noopener noreferrer" target="_blank">
                  <Header size="small">
                    <Icon name="code" />
                    <Header.Content>
                      Github Repository
                      <Header.Subheader>Source Code and Discussions</Header.Subheader>
                    </Header.Content>
                  </Header>
                </a>
              </div>
              <div className="p-4 mt-2 border border-solid rounded-lg hover:bg-gray-200 hover:cursor-pointer">
                <a href="mailto:klicker.support@uzh.ch">
                  <Header size="small">
                    <Icon name="mail outline" />
                    <Header.Content>
                      Contact
                      <Header.Subheader>Email to klicker.support@uzh.ch</Header.Subheader>
                    </Header.Content>
                  </Header>
                </a>
              </div>
            </div>
            <div className="mt-4 md:mt-0 flex-1 min-w-[500px] min-h-[800px]">
              <iframe
                className="clickup-embed clickup-dynamic-height"
                height="100%"
                src="https://forms.clickup.com/f/4dv27-1781/Z5ZVQBCR5R5FXXPB0Q"
                // style="background: transparent; border: 1px solid #ccc;"
                title="ClickUp Feedback Form"
                width="100%"
                // onWheel=""
              />
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
