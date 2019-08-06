/* eslint-disable react/prop-types, react/no-array-index-key */

import * as React from 'react'
import { Button, Icon, Menu, Popup, List, Modal, Embed } from 'semantic-ui-react'
import { defineMessages, FormattedMessage, IntlShape } from 'react-intl'
import { CHANGELOG } from '../../../constants'

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
  intl: IntlShape
  sessionId?: string
}

const defaultProps = {
  sessionId: undefined,
}

const SessionArea: React.FunctionComponent<Props> = ({ intl, sessionId }): React.ReactElement<any> => (
  <>
    <Menu.Item button>
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

    <Popup
      basic
      hoverable
      closeOnDocumentClick={false}
      closeOnPortalMouseLeave={false}
      closeOnTriggerMouseLeave={false}
      hideOnScroll={false}
      on="click"
      position="bottom right"
      trigger={<Menu.Item content={intl.formatMessage(messages.whatsNew)} icon="info" />}
    >
      <Popup.Content>
        <div className="popupChanges popupContent">
          <h3>Planned features (major)</h3>
          <p>
            <strong>
              A public roadmap is available on{' '}
              <a href="https://github.com/uzh-bf/klicker-uzh/projects/1" rel="noopener noreferrer" target="_blank">
                GitHub
              </a>
              .
            </strong>
          </p>
          <h3>New features (major)</h3>
          <List bulleted>
            {CHANGELOG.new.map(({ text, items }, index) => (
              <List.Item key={index}>
                {items ? <h4>{text}</h4> : text}
                {items && (
                  <List.List>
                    {items.map(item => (
                      <List.Item>{item}</List.Item>
                    ))}
                  </List.List>
                )}
              </List.Item>
            ))}
          </List>
        </div>
      </Popup.Content>
    </Popup>

    <Popup
      basic
      hoverable
      closeOnDocumentClick={false}
      closeOnPortalMouseLeave={false}
      closeOnTriggerMouseLeave={false}
      hideOnScroll={false}
      on="click"
      position="bottom right"
      trigger={<Menu.Item content={intl.formatMessage(messages.support)} icon="help" />}
    >
      <Popup.Content>
        <div className="popupHelp popupContent">
          <h3>Support</h3>
          <a href="mailto:klicker.support@uzh.ch">
            <Button fluid icon labelPosition="left">
              <Icon name="mail" />
              klicker.support@uzh.ch
            </Button>
          </a>

          <a href="https://uzh-bf.github.io/klicker-uzh/" rel="noopener noreferrer" target="_blank">
            <Button fluid icon labelPosition="left">
              <Icon name="external" />
              Documentation
            </Button>
          </a>

          <Modal
            closeIcon
            trigger={
              <Button fluid icon labelPosition="left">
                <Icon name="video" />
                Introductory Video
              </Button>
            }
          >
            <Modal.Header>Introductory Video</Modal.Header>
            <Modal.Content>
              <Embed id="Dpx7BWKeqlo" source="youtube" />
            </Modal.Content>
          </Modal>
        </div>
      </Popup.Content>
    </Popup>

    <style jsx>
      {`
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
      `}
    </style>
  </>
)

SessionArea.defaultProps = defaultProps

export default SessionArea
