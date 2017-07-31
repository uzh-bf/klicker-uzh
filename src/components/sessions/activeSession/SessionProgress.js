import React from 'react'
import PropTypes from 'prop-types'
import { Button, Icon } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import Question from './Question'

const SessionProgress = ({ intl }) => (
  <div className="container">
    <div className="sessionContainer">
      <div className="topRow">
        <div><Icon name="time" /> <FormattedMessage
          defaultMessage="Start"
          id="pages.runningSession.sessionProgress.paragraph.start" // TODO correct naming of identifier
        /></div>
        <div><Icon name="play circle" /> <FormattedMessage
          defaultMessage="Difficulty"
          id="pages.runningSession.sessionProgress.paragraph.runningTime" // TODO correct naming of identifier
        /></div>
        <div>
          <FormattedMessage
            defaultMessage="Sessions"
            id="pages.runningSession.sessionProgress.paragraph.sessions" // TODO correct naming of identifier
          />
        </div>
      </div>
      <div className="content">
        <Question status="Aktiv" title="Hello World" type="MC" />
      </div>
    </div>
    <div className="buttonSection">
      {/* TODO evaluation button floating to the right */}
      <Button
        className="cancel"
        content={intl.formatMessage({
          defaultMessage: 'Cancel',
          id: 'pages.runningSession.sessionProgress.button.cancel', // TODO correct naming of identifier
        })}
        icon="close"
        labelPosition="left"
      />
      <Button
        className="evaluation"
        content={intl.formatMessage({
          defaultMessage: 'Evaluation',
          id: 'pages.runningSession.sessionProgress.button.evaluation', // TODO correct naming of identifier
        })}
        icon="play"
        labelPosition="left"
      />
    </div>

    <style jsx>{`
        .container {
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
        }
        .sessionContainer {
          background-color: lightgrey;
          border: 1px solid;
          flex: 0 0 100%;
          margin-bottom: 0.5rem;
        }
        .sessionContainer > .topRow {
          display: flex;
          border-bottom: 1px solid;
          padding: 0.5rem;
        }
        .sessionContainer > .topRow > div {
          margin: 0 0.5rem;
        }
        .sessionContainer > .content {
          display: flex;
          padding: 0.5rem;
        }
        .buttonSection {
          width: 100%;
        }
        :global(.buttonSection > .ui.button.evaluation) {
          float: right;
        }
        .cancel {
          flex: 0 0 20%
          justify-content: flex-start;
        }
        .evaluation {
          flex: 0 0 20%
          justify-content: flex-end;
        }
      `}</style>
  </div>
)

SessionProgress.propTypes = {
  intl: PropTypes.shape({
    formatMessage: PropTypes.func.isRequired,
  }).isRequired,
}

export default SessionProgress
