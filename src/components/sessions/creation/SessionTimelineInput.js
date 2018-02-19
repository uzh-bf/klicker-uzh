import React from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import { adjust } from 'ramda'
import { FormattedMessage } from 'react-intl'
import { Icon, Message } from 'semantic-ui-react'

import QuestionDropzone from './QuestionDropzone'
import QuestionSingle from '../../questions/QuestionSingle'

const propTypes = {
  input: PropTypes.shape({
    onChange: PropTypes.func.isRequired,
    value: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        questions: PropTypes.arrayOf(
          PropTypes.shape({
            title: PropTypes.string.isRequired,
            type: PropTypes.string.isRequired,
          }),
        ),
      }),
    ),
  }).isRequired,
}

const SessionTimelineInput = ({ input: { value, onChange } }) => {
  // handle creation of an entirely new block
  const handleNewBlock = (newQuestion) => {
    onChange([...value, { questions: [newQuestion] }])
  }

  // handle extending a block with a further question
  const handleExtendBlock = blockIndex => (newQuestion) => {
    onChange(
      adjust(prev => ({ ...prev, questions: [...prev.questions, newQuestion] }), blockIndex, value),
    )
  }

  return (
    <div className="sessionTimeline">
      {value.map((block, index) => (
        <div className="timelineItem" key={block.id}>
          <div className="title">
            <span>Block {index + 1}</span>
            <Icon name="settings" />
          </div>

          <div className="questions">
            {block.questions.map(({
 id, title, type, version,
}) => (
  <QuestionSingle id={id} title={title} type={type} version={version} />
            ))}
          </div>

          <div className="questionDropzone">
            <QuestionDropzone onDrop={handleExtendBlock(index)} />
          </div>
        </div>
      ))}

      <div className="timelineItem">
        <div className="title">
          <FormattedMessage defaultMessage="New Block" id="sessionCreation.newBlock" />
          <a data-tip data-for="newBlockHelp">
            <Icon name="question circle" />
          </a>
        </div>

        <ReactTooltip delayHide={250} delayShow={250} id="newBlockHelp" place="right">
          <FormattedMessage
            defaultMessage="Group questions inside a question block to activate and evaluate them simultaneously."
            id="sessionCreation.newBlock.tooltip"
          />
        </ReactTooltip>

        <div className="blockDropzone">
          <QuestionDropzone onDrop={handleNewBlock} />
        </div>

        {value.length === 0 && (
          <div className="message">
            <Message info>
              <FormattedMessage
                defaultMessage="Drag & drop a question into the dropzone."
                id="sessionCreation.emptyDropzoneInfo"
              />
            </Message>
          </div>
        )}
      </div>
      <style jsx>{`
        @import 'src/theme';

        .sessionTimeline {
          display: flex;
          flex-direction: column;

          height: 100%;
          padding: 0.5rem;

          > .timelineItem {
            display: flex;
            flex-direction: column;

            padding: 0.5rem;

            > :global(*):not(:first-child) {
              margin-top: -2px;
            }

            .title {
              display: flex;
              flex-direction: row;
              justify-content: space-between;

              font-weight: bold;
              margin-bottom: 0.5rem;

              a {
                color: $color-primary;
                font-size: 1.25rem;
              }
            }

            .message,
            .questionDropzone {
              margin-top: 0.5rem;
            }

            .questions {
              font-size: 0.9rem;

              > :global(*):not(:first-child) {
                margin-top: -2px;
              }
            }
          }

          @include desktop-tablet-only {
            flex-flow: row wrap;

            border-left: 1px solid lightgrey;
            border-bottom: 1px solid lightgrey;

            > .timelineItem {
              width: 15rem;

              &:not(:last-child) {
                border-right: 1px solid lightgrey;
                margin-bottom: 0;
              }
            }
          }
        }
      `}</style>
    </div>
  )
}

SessionTimelineInput.propTypes = propTypes

export default SessionTimelineInput
