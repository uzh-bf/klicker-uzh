import React from 'react'
import { Button, Icon } from 'semantic-ui-react'

interface Props {
  alreadyVoted?: boolean
  content: string
  onDelete?: any
  showDelete?: boolean
  showVotes?: boolean
  updateVotes?: any
  votes: number
}

const defaultProps = {
  onDelete: (f): any => f,
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
}: Props): React.ReactElement => (
  <div className="flex items-center border border-solid bg-primary-10% border-primary">
    <div className="flex-1 p-2">{content}</div>

    {showDelete && (
      <div className="flex-initial p-2 max-w-4">
        <Button basic fluid icon="trash" onClick={onDelete} />
      </div>
    )}

    {showVotes && (
      <Button
        className="items-center justify-center flex-initial border-l border-gray-500 max-w-12"
        disabled={alreadyVoted}
        onClick={updateVotes && updateVotes()}
      >
        <Icon name={alreadyVoted ? 'thumbs up' : 'thumbs up outline'} />
        {votes}
      </Button>
    )}
  </div>
)

Feedback.defaultProps = defaultProps

export default Feedback
