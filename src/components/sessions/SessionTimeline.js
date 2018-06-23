import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import QRCode from 'qrcode.react'
import { intlShape, FormattedMessage } from 'react-intl'
import {
  Button, Icon, Popup, Message,
} from 'semantic-ui-react'

import { QuestionBlock } from '../questions'

const propTypes = {
  activeStep: PropTypes.number.isRequired,
  blocks: PropTypes.array,
  handleEndSession: PropTypes.func.isRequired,
  handleNextBlock: PropTypes.func.isRequired,
  handlePauseSession: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  runtime: PropTypes.string,
  sessionId: PropTypes.string.isRequired,
  shortname: PropTypes.string.isRequired,
  startedAt: PropTypes.string,
}

const defaultProps = {
  blocks: [],
  runtime: '00:00:00',
  startedAt: '00:00:00',
}

const getMessage = (intl, num, max) => {
  if (num === 0) {
    return {
      icon: 'play',
      label: intl.formatMessage({
        defaultMessage: 'Open first block',
        id: 'runningSession.button.start',
      }),
    }
  }

  if (num % 2 === 1) {
    return {
      icon: 'right arrow',
      label: intl.formatMessage({
        defaultMessage: 'Close current block',
        id: 'runningSession.button.closeBlock',
      }),
    }
  }

  if (num === max) {
    return {
      icon: 'stop',
      label: intl.formatMessage({
        defaultMessage: 'Finish session',
        id: 'runningSession.button.finish',
      }),
    }
  }

  return {
    icon: 'right arrow',
    label: intl.formatMessage({
      defaultMessage: 'Open next block',
      id: 'runningSession.button.openBlock',
    }),
  }
}

const SessionTimeline = ({
  sessionId,
  blocks,
  intl,
  runtime,
  startedAt,
  shortname,
  activeStep,
  handleNextBlock,
  handleEndSession,
  handlePauseSession,
}) => {
  const isFeedbackSession = blocks.length === 0

  return (
    <div className="sessionTimeline">
      <div className="topRow">
        <div className="infos">
          <div className="startingTime">
            <Icon name="time" />
            {' '}
            {startedAt}
          </div>
          <div className="runningTime">
            <Icon name="play circle" />
            {' '}
            {runtime}
          </div>
        </div>

        <div className="actions">
          <Popup
            basic
            hideOnScroll
            on="click"
            position="bottom right"
            trigger={(
              <div className="qrTrigger">
                <Button icon size="small">
                  <Icon name="qrcode" />
                </Button>
              </div>
)}
          >
            <Popup.Content>
              <div className="popupContent">
                <div className="qr">
                  <QRCode
                    value={`https://beta.klicker.uzh.ch/join/${shortname}`}
                  />
                </div>

                <a
                  href={`/qr/${shortname}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Button fluid primary>
                    <FormattedMessage
                      defaultMessage="Present QR"
                      id="sessionArea.qrPresentation"
                    />
                  </Button>
                </a>
              </div>
            </Popup.Content>
          </Popup>
          <a
            href={`/join/${shortname}`}
            rel="noopener noreferrer"
            target="_blank"
          >
            <Button icon labelPosition="left" size="small">
              <Icon name="external" />
              <FormattedMessage
                defaultMessage="Student View"
                id="sessionArea.toJoinSession"
                values={{ shortname }}
              />
            </Button>
          </a>
          <a
            href={`/sessions/evaluation/${sessionId}`}
            rel="noopener noreferrer"
            target="_blank"
          >
            <Button
              icon
              disabled={isFeedbackSession}
              labelPosition="left"
              size="small"
            >
              <Icon name="external" />
              <FormattedMessage
                defaultMessage="Evaluation (Results)"
                id="runningSession.button.evaluation"
              />
            </Button>
          </a>
        </div>
      </div>

      <div className="blocks">
        {blocks.map((block, index) => (
          <div className="blockWrap">
            <div className={classNames('waiting', { first: index === 0 })}>
              <Icon
                color={index === activeStep / 2 && 'green'}
                name={
                  index === 0 ? 'video play outline' : 'pause circle outline'
                }
                size="big"
              />
            </div>
            <div className="block" key={block.id}>
              <QuestionBlock
                noVersions
                showSolutions
                index={index + 1}
                questions={block.instances.map(({ id, question, version }) => ({
                  id,
                  title: question.title,
                  type: question.type,
                  version,
                }))}
                status={block.status}
              />
            </div>
            {index === blocks.length - 1 && (
              <div className="waiting last">
                <Icon
                  color={activeStep === blocks.length * 2 && 'red'}
                  name="stop circle outline"
                  size="big"
                />
              </div>
            )}
          </div>
        ))}
        {isFeedbackSession && (
          <div className="blockWrap">
            <Message info>
              <FormattedMessage
                defaultMessage="This feedback session does not contain any questions."
                id="runningSession.message.feedbackSession"
              />
            </Message>
          </div>
        )}
      </div>
      <div className="buttons">
        <div className="left">
          <Button
            icon
            labelPosition="left"
            size="small"
            onClick={handlePauseSession}
          >
            <Icon name="pause" />
            <FormattedMessage
              defaultMessage="Pause Session"
              id="sessionArea.button.pauseSession"
            />
          </Button>
        </div>

        {isFeedbackSession ? (
          <Button
            // show the session finish button for feedback sessions
            color="red"
            content={getMessage(intl, 2, 2).label}
            icon={getMessage(intl, 2, 2).icon}
            labelPosition="left"
            onClick={handleEndSession}
          />
        ) : (
          <Button
            // show dynamic buttons for all other sessions
            color={activeStep === blocks.length * 2 ? 'red' : 'blue'}
            content={getMessage(intl, activeStep, blocks.length * 2).label}
            icon={getMessage(intl, activeStep, blocks.length * 2).icon}
            labelPosition="left"
            onClick={
              activeStep >= blocks.length * 2
                ? handleEndSession
                : handleNextBlock
            }
          />
        )}
      </div>
      <style jsx>
        {`
          @import 'src/theme';

          .sessionTimeline {
            display: flex;
            flex-direction: column;

            .topRow {
              flex: 1;

              justify-content: space-between;
            }

            .topRow,
            .infos,
            .actions {
              display: flex;
              flex-flow: row wrap;
              align-items: flex-end;
            }

            .actions > a:last-child > :global(button) {
              margin: 0;
            }

            .runningTime {
              margin-left: 2rem;
            }

            .popupContent {
              display: flex;
              flex-direction: column;
              align-items: center;

              .qr {
                margin-bottom: 0.5rem;
              }
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

              margin-top: 0.5rem;

              > :global(button) {
                margin-right: 0;
              }
            }

            @include desktop-tablet-only {
              flex-flow: row wrap;

              .topRow {
                flex: 0 0 100%;

                padding-bottom: 0.5rem;
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
        `}
      </style>
    </div>
  )
}

SessionTimeline.propTypes = propTypes
SessionTimeline.defaultProps = defaultProps

export default SessionTimeline
