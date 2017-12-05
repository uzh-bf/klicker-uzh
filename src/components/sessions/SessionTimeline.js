import React from 'react'
import PropTypes from 'prop-types'
import Link from 'next/link'
import classNames from 'classnames'
import { intlShape, FormattedMessage } from 'react-intl'
import { Button, Icon } from 'semantic-ui-react'

import { QuestionBlock } from '../questions'

const propTypes = {
  blocks: PropTypes.array, // TODO: extend
  handleLeftActionClick: PropTypes.func.isRequired,
  handleRightActionClick: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  runtime: PropTypes.string,
  sessionId: PropTypes.string.isRequired,
  startedAt: PropTypes.string,
}

const defaultProps = {
  blocks: [],
  runtime: '00:00:00',
  startedAt: '00:00:00',
}

const SessionTimeline = ({
  sessionId,
  blocks,
  intl,
  runtime,
  startedAt,
  handleLeftActionClick,
  handleRightActionClick,
}) => (
  <div className="sessionTimeline">
    <div className="topRow">
      <div className="startingTime">
        <Icon name="time" /> {startedAt}
      </div>
      <div className="runningTime">
        <Icon name="play circle" /> {runtime}
      </div>
      <div className="evaluationLink">
        <Icon name="external" />{' '}
        <Link prefetch href={`/sessions/evaluation/${sessionId}`}>
          <a target="_blank">
            <FormattedMessage defaultMessage="Evaluation" id="runningSession.button.evaluation" />
          </a>
        </Link>
      </div>
    </div>
    <div className="blocks">
      {blocks.map((block, index) => (
        <div className="blockWrap">
          <div className={classNames('waiting', { first: index === 0 })}>
            <Icon name={index === 0 ? 'video play outline' : 'pause circle outline'} size="big" />
          </div>
          <div className="block" key={block.id}>
            <QuestionBlock
              showSolutions
              questions={block.instances.map(({ id, question, version }) => ({
                id,
                title: question.title,
                type: question.type,
                version,
              }))}
              status={block.status}
              timeLimit={60}
            />
          </div>
          {index === blocks.length - 1 && (
            <div className="waiting last">
              <Icon name="stop circle outline" size="big" />
            </div>
          )}
        </div>
      ))}
    </div>
    <div className="buttons">
      <Button
        color="red"
        content={intl.formatMessage({
          defaultMessage: 'Cancel',
          id: 'runningSession.button.cancel',
        })}
        icon="remove"
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
    <style jsx>{`
      @import 'src/theme';

      .sessionTimeline {
        display: flex;
        flex-direction: column;

        .topRow {
          flex: 1;

          display: flex;

          background: lightgrey;
          padding: 1rem;
        }

        .runningTime,
        .evaluationLink {
          margin-left: 2rem;
        }

        .blocks {
          flex: 1;

          display: flex;
          flex-direction: column;

          border: 1px solid lightgray;
          padding: 1rem;
        }

        .blockWrap {
          display: flex;
          flex-direction: column;
          align-items: center;

          background: linear-gradient(
            to right,
            transparent 0%,
            transparent calc(50% - 1.01px),
            lightgrey calc(50% - 1px),
            lightgrey calc(50% + 1px),
            transparent calc(50% + 1.01px),
            transparent 100%
          );

          .block {
            flex: 1;
            width: 100%;
          }

          .waiting {
            margin: 0.2rem 0;
            padding: 0.5rem 0;

            &.first {
              padding-top: 0;
              margin-top: 0;
            }

            &.last {
              padding-bottom: 0;
              margin-bottom: 0;
            }

            :global(i) {
              background-color: white;
              color: lightgrey;
              margin-right: 0;
            }
          }
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

        @include desktop-tablet-only {
          flex-flow: row wrap;

          .topRow {
            flex: 0 0 100%;

            padding: 0.5rem;
          }

          .blocks {
            flex: 0 0 100%;

            flex-direction: row;

            padding: 0.5rem;
          }

          .blockWrap {
            flex-direction: row;
            background: linear-gradient(
              to bottom,
              transparent 0%,
              transparent calc(50% - 0.81px),
              lightgrey calc(50% - 0.8px),
              lightgrey calc(50% + 0.8px),
              transparent calc(50% + 0.81px),
              transparent 100%
            );

            .block,
            .block:not(:first-child) {
              margin: 0.3rem;
              width: 17rem;
            }

            .waiting {
              margin: 0 0.2rem;
              padding: 0 0.7rem;

              &.first {
                padding-left: 0;
                margin-left: 0;
              }

              &.last {
                padding-right: 0;
                margin-right: 0;
              }
            }
          }
        }
      }
    `}</style>
  </div>
)

SessionTimeline.propTypes = propTypes
SessionTimeline.defaultProps = defaultProps

export default SessionTimeline
