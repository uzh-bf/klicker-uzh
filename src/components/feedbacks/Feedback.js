import React from 'react'
import PropTypes from 'prop-types'
import { Button, Icon } from 'semantic-ui-react'

const propTypes = {
  alreadyVoted: PropTypes.bool.isRequired,
  content: PropTypes.string.isRequired,
  onDelete: PropTypes.func,
  showDelete: PropTypes.bool,
  showVotes: PropTypes.bool,
  updateVotes: PropTypes.func.isRequired,
  votes: PropTypes.number.isRequired,
}

const defaultProps = {
  onDelete: f => f,
  showDelete: true,
  showVotes: false,
}

const Feedback = ({
  alreadyVoted,
  content,
  showDelete,
  showVotes,
  updateVotes,
  votes,
  onDelete,
}) => (
  <div className="feedback">
    <div className="content">
      {content}
    </div>
    {showDelete && (
      <div className="delete">
        <Button basic fluid icon="trash" onClick={onDelete} />
      </div>
    )}

    {showVotes && (
      <Button
        className="votes"
        disabled={alreadyVoted}
        onClick={updateVotes && updateVotes()}
      >
        <Icon name={alreadyVoted ? 'thumbs up' : 'thumbs outline up'} />
        {votes}
      </Button>
    )}

    <style jsx>
      {`
        @import 'src/theme';

        .feedback {
          display: flex;

          background: $color-primary-10p;
          border: 1px solid $color-primary;

          .content,
          .delete {
            padding: 0.7rem;
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
        }
      `}
    </style>
  </div>
)

Feedback.propTypes = propTypes
Feedback.defaultProps = defaultProps

export default Feedback
