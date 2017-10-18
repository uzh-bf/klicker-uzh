import React from 'react'
import PropTypes from 'prop-types'
import { Button, Icon } from 'semantic-ui-react'

const propTypes = {
  content: PropTypes.string.isRequired,
  index: PropTypes.number.isRequired,
  showDelete: PropTypes.bool,
  updateVotes: PropTypes.func.isRequired,
  votes: PropTypes.number.isRequired,
}

const defaultProps = {
  showDelete: true,
}

const Feedback = ({ content, index, showDelete, updateVotes, votes }) => (
  <div className="feedback">
    <div className="content">{content}</div>
    {showDelete && (
      <div className="delete">
        <Button basic icon="trash outline" fluid />
      </div>
    )}

    <div className="votes" onClick={() => updateVotes(index)}>
      <Icon name={'thumbs outline up'} />
      {votes}
    </div>

    <style jsx>{`
      .feedback {
        display: flex;

        background: lightgrey;
        border: 1px solid grey;

        .content,
        .delete {
          padding: 1rem;
        }

        .content {
          flex: 1;
        }

        .delete {
          flex: 0 0 1rem;
          align-self: center;
        }

        .votes {
          flex: 0 0 5rem;

          display: flex;
          align-items: center;
          justify-content: center;

          border-left: 1px solid grey;
        }

        @media all and (min-width: 768px) {
          .content,
          .delete {
            padding: 0.5rem;
          }
        }
      }
    `}</style>
  </div>
)

Feedback.propTypes = propTypes
Feedback.defaultProps = defaultProps

export default Feedback
