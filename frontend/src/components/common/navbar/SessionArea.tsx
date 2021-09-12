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
        onClose={() => setOpen(false)}
        onOpen={() => setOpen(true)}
        open={open}
        trigger={<Menu.Item content={intl.formatMessage(messages.support)} icon="help" />}
        width={200}
      >
        <Modal.Header>Support</Modal.Header>
        <Modal.Content>
          <Modal.Description>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="hover:bg-gray-200 hover:cursor-pointer rounded-lg p-4">
                <a href="https://uzh-bf.github.io/klicker-uzh/" rel="noopener noreferrer" target="_blank">
                  <Icon name="file alternate outline" size="massive" color="black" />
                  <Header>
                    <Header.Content>
                      Documentation
                      <Header.Subheader>User manual, Features and more</Header.Subheader>
                    </Header.Content>
                  </Header>
                </a>
              </div>
              <div className="hover:bg-gray-200 hover:cursor-pointer rounded-lg p-4">
                <a
                  href="https://forms.clickup.com/f/4dv27-1781/Z5ZVQBCR5R5FXXPB0Q"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Icon name="comment outline" size="massive" color="black" />
                  <Header>
                    <Header.Content>
                      Feedback
                      <Header.Subheader>Tell us about your opinion on KlickerUZH</Header.Subheader>
                    </Header.Content>
                  </Header>
                </a>
              </div>
              <div className="hover:bg-gray-200 hover:cursor-pointer rounded-lg p-4">
                <a href="mailto:klicker.support@uzh.ch">
                  <Icon name="mail outline" size="massive" color="black" />
                  <Header>
                    <Header.Content>
                      Contact
                      <Header.Subheader>klicker.support@uzh.ch</Header.Subheader>
                    </Header.Content>
                  </Header>
                </a>
              </div>
            </div>
          </Modal.Description>
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
