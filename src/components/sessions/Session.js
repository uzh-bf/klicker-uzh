import React from 'react'
import PropTypes from 'prop-types'
import moment from 'moment'
import Link from 'next/link'
import { Button, Icon } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import { QuestionBlock } from '../questions'

const propTypes = {
  blocks: PropTypes.array,
  button: PropTypes.shape({
    icon: PropTypes.oneOf(['copy', 'play']).isRequired,
    message: PropTypes.element.isRequired,
    onClick: PropTypes.func.isRequired,
  }).isRequired,
  createdAt: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
}

const defaultProps = {
  blocks: [],
}

const Session = ({
  button, createdAt, id, name, blocks,
}) => (
  <div className="session">
    <h2 className="title">
      {/* {id.slice(0, 7)} - {name} */}
      {name}
    </h2>
    <div className="date">
      <FormattedMessage defaultMessage="Created on" id="sessionHistory.string.createdOn" />{' '}
      {moment(createdAt).format('DD.MM.YYYY HH:MM')}
    </div>

    <div className="details">
      {blocks.map(block => (
        <div className="block" key={block.id}>
          <QuestionBlock
            questions={block.instances.map(instance => ({
              id: instance.id,
              title: instance.question.title,
              type: instance.question.type,
              versions: instance.question.versions,
            }))}
            showSolutions={block.showSolutions}
            timeLimit={block.timeLimit}
          />
        </div>
      ))}
      <div className="actionArea">
        <Link prefetch href={`/sessions/evaluation/${id}`}>
          <Button icon labelPosition="left">
            <Icon name="external" />
            Evaluation
          </Button>
        </Link>
        <Button icon primary className="lastButton" labelPosition="left" onClick={button.onClick}>
          <Icon name={button.icon} />
          {button.message}
        </Button>
      </div>
    </div>

    <style jsx>{`
      @import 'src/theme';

      .session,
      .details {
        display: flex;
        flex-direction: column;
        flex: 1;
      }
      .title,
      .date {
        margin: auto;
        margin-bottom: 0.5rem;
      }
      .block {
        margin-bottom: 0.5rem;
      }
      .actionArea {
        display: flex;
        flex-direction: column;

        > :global(*) {
          margin-bottom: 0.3rem;
        }

        :global(.button) {
          margin-right: 0 !important;
        }

        :global(.lastButton) {
          margin-bottom: 0 !important;
        }
      }

      @include desktop-tablet-only {
        .session,
        .details {
          flex-flow: row wrap;
        }
        .title,
        .date {
          flex: 0 0 50%;
          margin: 0;
        }
        .title {
          font-size: 1.2rem;
          margin-bottom: 0.5rem;
        }
        .date {
          align-self: center;
          text-align: right;
        }
        .details {
          //border: 1px solid lightgrey;
        }
        .block {
          flex: 1;
          margin: 0;
          margin-right: 0.5rem;
        }
        .actionArea {
          align-self: flex-end;
        }
      }
    `}</style>
  </div>
)

Session.propTypes = propTypes
Session.defaultProps = defaultProps

export default Session
