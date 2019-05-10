import React from 'react'
import PropTypes from 'prop-types'
import { Button, Icon, Dropdown } from 'semantic-ui-react'

const propTypes = {
  alreadyVoted: PropTypes.bool.isRequired,
  content: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  onDelete: PropTypes.func,
  showDelete: PropTypes.bool,
  showVotes: PropTypes.bool,
  tagOptions: PropTypes.arrayOf({
    text: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
  }).isRequired,
  updateVotes: PropTypes.func.isRequired,
  votes: PropTypes.number.isRequired,
  value: PropTypes.arrayOf(PropTypes.string),
}

const defaultProps = {
  onChange: f => f,
  onDelete: f => f,
  showDelete: true,
  showVotes: false,
  value: [],
}

const Feedback = ({
  alreadyVoted,
  content,
  showDelete,
  showVotes,
  tagOptions,
  updateVotes,
  value,
  votes,
  onChange,
  onDelete,
}) => (
  <div className="feedback">
    <div className="content">{content}</div>
    {showDelete && (
      <div className="delete">
        <Button basic fluid icon="trash" onClick={onDelete} />
      </div>
    )}

    {!showVotes && (
      <Dropdown
        multiple
        search
        selection
        options={tagOptions}
        renderLabel={label => ({ color: 'blue', content: `${label.text}`, icon: 'check' })}
        value={value}
        onChange={(_, { value: newVal }) => onChange(newVal)}
      />
    )}

    {showVotes && (
      <Button className="votes" disabled={alreadyVoted} onClick={updateVotes && updateVotes()}>
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
