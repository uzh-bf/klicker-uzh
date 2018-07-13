/* eslint-disable react/no-array-index-key */

import React from 'react'
import PropTypes from 'prop-types'
import {
  Button,
  Icon,
  Menu,
  Popup,
  List,
  Modal,
  Embed,
} from 'semantic-ui-react'
import { defineMessages, intlShape, FormattedMessage } from 'react-intl'
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

const propTypes = {
  intl: intlShape.isRequired,
  sessionId: PropTypes.string,
}

const defaultProps = {
  sessionId: undefined,
}

const SessionArea = ({ intl, sessionId }) => (
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
        <FormattedMessage
          defaultMessage="Running Session"
          id="sessionArea.toRunningSession"
        />
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
      trigger={(
        <Menu.Item
          content={intl.formatMessage(messages.whatsNew)}
          icon="info"
        />
)}
    >
      <Popup.Content>
        <div className="popupChanges popupContent">
          <h3>New features (major)</h3>
          <List bulleted>
            {CHANGELOG.new.map(({ text, items }, index) => (
              <List.Item key={index}>
                {items ? <h4>{text}</h4> : text}
                {items && (
                  <List.List>
                    {items.map(item => <List.Item>{item}</List.Item>)}
                  </List.List>
                )}
              </List.Item>
            ))}
          </List>

          <h3>Planned features (major)</h3>
          <p>
            <strong>
              A public roadmap is available on{' '}
              <a
                href="https://trello.com/b/xw0D1k6l"
                rel="noopener noreferrer"
                target="_blank"
              >
                https://trello.com/b/xw0D1k6l
              </a>
              .
            </strong>
          </p>
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
      trigger={
        <Menu.Item content={intl.formatMessage(messages.support)} icon="help" />
      }
    >
      <Popup.Content>
        <div className="popupHelp popupContent">
          <h3>Support</h3>
          <a href="mailto:klicker.support@uzh.ch">
            <Button icon labelPosition="left">
              <Icon name="mail" />
              klicker.support@uzh.ch
            </Button>
          </a>

          <a
            href="https://uzh-bf.github.io/klicker-docs/"
            rel="noopener noreferrer"
            target="_blank"
          >
            <Button icon labelPosition="left">
              <Icon name="external" />
              Documentation
            </Button>
          </a>

          <Modal
            closeIcon
            trigger={(
              <Button icon labelPosition="left">
                <Icon name="video" />
                Introductory Video
              </Button>
)}
          >
            <Modal.Header>Introductory Video</Modal.Header>
            <Modal.Content>
              <Embed id="8nS-fvi86l0" source="youtube" />
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
          width: 35rem;
        }
      `}
    </style>
  </>
)

SessionArea.propTypes = propTypes
SessionArea.defaultProps = defaultProps

export default SessionArea
