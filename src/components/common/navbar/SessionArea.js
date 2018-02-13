import React from 'react'
import PropTypes from 'prop-types'
import { Button, Icon, Menu, Popup } from 'semantic-ui-react'
import { intlShape, FormattedMessage } from 'react-intl'

const propTypes = {
  intl: intlShape.isRequired,
  sessionId: PropTypes.string,
  shortname: PropTypes.string.isRequired,
}

const defaultProps = {
  sessionId: undefined,
}

const SessionArea = ({ intl, sessionId, shortname }) => (
  <React.Fragment>
    <Menu.Item>
      <a href="/sessions/running">
        <Button icon primary disabled={!sessionId} labelPosition="left" size="small">
          <Icon name="play" />
          <FormattedMessage defaultMessage="Running Session" id="sessionArea.toRunningSession" />
        </Button>
      </a>
    </Menu.Item>

    <Menu.Item>
      <a href={`/join/${shortname}`} target="_blank">
        <Button icon labelPosition="left" size="small">
          <Icon name="external" />
          <FormattedMessage
            defaultMessage="Student View"
            id="sessionArea.toJoinSession"
            values={{ shortname }}
          />
        </Button>
      </a>
    </Menu.Item>

    <Popup
      basic
      hideOnScroll
      position="bottom right"
      trigger={
        <Menu.Item
          content={intl.formatMessage({ defaultMessage: 'Updates', id: 'sessionArea.whatsNew' })}
          icon="info"
        />
      }
    >
      <Popup.Content>
        <div className="popupContent">
          <h3>Latest release</h3>
          <ul>
            <li>bla</li>
          </ul>

          <h3>Upcoming features</h3>
          <ul>
            <li>hello world integration</li>
          </ul>
        </div>
      </Popup.Content>
    </Popup>

    <style jsx>{`
      .popupContent {
        padding: 1rem;
      }
    `}</style>
  </React.Fragment>
)

SessionArea.propTypes = propTypes
SessionArea.defaultProps = defaultProps

export default SessionArea
