import React from 'react'
import PropTypes from 'prop-types'
import { intlShape } from 'react-intl'
import { Button, Icon } from 'semantic-ui-react'

import QuestionBlock from '../questions/QuestionBlock'

const propTypes = {
  blocks: PropTypes.array, // TODO: extend
  handleLeftActionClick: PropTypes.func.isRequired,
  handleRightActionClick: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
}

const defaultProps = {
  blocks: [],
}

const SessionTimeline = ({
  blocks, intl, handleLeftActionClick, handleRightActionClick,
}) => (
  <div className="sessionTimeline">
    <div className="topRow">
      <div className="startingTime">
        <Icon name="time" /> 18:17:22
      </div>
      <div className="runningTime">
        <Icon name="play circle" /> 12:56
      </div>
    </div>
    <div className="blocks">
      {blocks.map(block => (
        <div key={block.key} className="block">
          <QuestionBlock
            showSolutions
            timeLimit={60}
            status={block.status}
            questions={block.instances.map(instance => ({
              id: instance.id,
              title: instance.question.title,
              type: instance.question.type,
            }))}
          />
        </div>
      ))}
    </div>
    <div className="buttons">
      <Button
        content={intl.formatMessage({
          defaultMessage: 'Previous',
          id: 'runningSession.button.previous',
        })}
        icon="left arrow"
        labelPosition="left"
        size="large"
        onClick={handleLeftActionClick}
      />
      <Button
        primary
        content={intl.formatMessage({
          defaultMessage: 'Next',
          id: 'runningSession.button.next',
        })}
        icon="right arrow"
        labelPosition="right"
        size="large"
        onClick={handleRightActionClick}
      />
    </div>
    <style jsx>
      {`
        .sessionTimeline {
          display: flex;
          flex-direction: column;
        }

        .topRow {
          flex: 1;

          display: flex;

          background: grey;
          padding: 1rem;
        }

        .runningTime {
          margin-left: 2rem;
        }

        .blocks {
          flex: 1;

          display: flex;
          flex-direction: column;

          border: 1px solid grey;
          padding: 1rem;
        }

        .block:not(:first-child) {
          margin-top: 1rem;
        }

        .buttons {
          flex: 1;

          display: flex;
          flex-flow: row wrap;
          justify-content: space-between;

          margin-top: 1rem;
        }

        .buttons > :global(button) {
          margin-right: 0;
        }

        @media all and (min-width: 768px) {
          .sessionTimeline {
            flex-flow: row wrap;
          }

          .topRow {
            flex: 0 0 100%;

            padding: 0.5rem;
          }

          .blocks {
            flex: 0 0 100%;

            flex-direction: row;

            padding: 0.5rem;
          }

          .block,
          .block:not(:first-child) {
            margin: 0.3rem;
          }
        }
      `}
    </style>
  </div>
)

SessionTimeline.propTypes = propTypes
SessionTimeline.defaultProps = defaultProps

export default SessionTimeline
