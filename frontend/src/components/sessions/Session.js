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
    <h2 className="title">{name}</h2>
    <div className="date">
      <FormattedMessage defaultMessage="Created on" id="sessionList.string.createdOn" />{' '}
      {moment(createdAt).format('DD.MM.YY HH:mm')}
    </div>

    <div className="details">
      {blocks.map(({
 id: blockId, instances, showSolutions, timeLimit,
}) => (
  <div className="block" key={blockId}>
    <QuestionBlock
      questions={instances.map(({ id: instanceId, question, version }) => ({
              id: instanceId,
              title: question.title,
              type: question.type,
              version,
            }))}
      showSolutions={showSolutions}
      timeLimit={timeLimit}
    />
  </div>
      ))}
      <div className="actionArea">
        <Link
          as={`/sessions/evaluation/${id}`}
          href={{ pathname: '/sessions/evaluation', query: { sessionId: id } }}
        >
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
