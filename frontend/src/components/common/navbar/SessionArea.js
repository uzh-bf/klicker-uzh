/* eslint-disable react/no-array-index-key */

import React from 'react'
import PropTypes from 'prop-types'
import { Button, Icon, Menu, Popup, List } from 'semantic-ui-react'
import { intlShape, FormattedMessage } from 'react-intl'

const propTypes = {
  intl: intlShape.isRequired,
  runtime: PropTypes.string,
  sessionId: PropTypes.string,
}

const defaultProps = {
  runtime: undefined,
  sessionId: undefined,
}

const changelog = {
  new: [
    {
      items: [
        'Multiple-choice questions can be created and evaluated.',
        'One can define solutions for SC- and MC-questions and display them while presenting the results (optional).',
        'More advanced visualizations for all question types, including word clouds and aggregated tables.',
      ],
      text: 'Extended question types and visualizations',
    },
    {
      items: [
        'Questions can be grouped into sessions and question blocks.',
        'Each session could e.g. correspond to a single lecture.',
        'A question block is part of a session and represents a group of questions that are evaluated simultaneously.',
        'The parts of a session are activated on a predefined timeline.',
      ],
      text: 'Sessions & question blocks',
    },
    {
      items: [
        'The new feedback channel enables the collection of open text feedbacks over the course of the entire session (optional).',
        'It also allows the students to give feedback on the speed and difficulty of the session at any point in time (optional).',
      ],
      text: 'Feedback-Channel (experimental)',
    },
    {
      items: [
        'Currently supported languages are English and German.',
        'The tool is easily translateable to other languages (open-source).',
      ],
      text: 'Support for multiple languages',
    },
  ],
  planned: [
    { text: 'Many overall improvements for performance and user experience.' },
    { text: 'Advanced session management (quick creation, copying and other modifications).' },
    {
      text:
        'On-the-fly modification of running sessions (e.g., adding questions while a session is already running and starting "empty" sessions).',
    },

    { text: 'Open-source documentation to encourage collaboration.' },
  ],
}

const SessionArea = ({ intl, runtime, sessionId }) => (
  <React.Fragment>
    <Menu.Item>
      <a href="/sessions/running">
        <Button
          icon
          color={sessionId && 'green'}
          disabled={!sessionId}
          labelPosition="left"
          size="small"
        >
          <Icon name="play" />
          <FormattedMessage defaultMessage="Running Session" id="sessionArea.toRunningSession" />
          {runtime && ` (${runtime})`}
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
          <h3>New features (major)</h3>
          <List bulleted>
            {changelog.new.map(({ text, items }, index) => (
              <List.Item key={index}>
                {items ? <h4>{text}</h4> : text}
                {items && <List.List>{items.map(item => <List.Item>{item}</List.Item>)}</List.List>}
              </List.Item>
            ))}
          </List>

          <h3>Planned features (major)</h3>
          <p>
            <strong>
              A public roadmap is available on{' '}
              <a href="https://trello.com/b/xw0D1k6l" rel="noopener noreferrer" target="_blank">
                https://trello.com/b/xw0D1k6l
              </a>.
            </strong>
          </p>
        </div>
      </Popup.Content>
    </Popup>

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
        width: 35rem;
      }
    `}</style>
  </React.Fragment>
)

SessionArea.propTypes = propTypes
SessionArea.defaultProps = defaultProps

export default SessionArea
