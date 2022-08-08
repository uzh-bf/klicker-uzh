import dayjs from 'dayjs'
import { FormattedMessage } from 'react-intl'
import { Button } from '@uzh-bf/design-system'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faThumbsUp } from '@fortawesome/free-regular-svg-icons'
import { twMerge } from 'tailwind-merge'
import { faQuestion } from '@fortawesome/free-solid-svg-icons'

import { IFeedback } from '../../../@types/feedbacks'

interface Props extends Omit<IFeedback, 'id'> {
  upvoted?: boolean
  onUpvoteFeedback?: () => void
  onPositiveResponseReaction?: (responseId: string) => void
  onNegativeResponseReaction?: (responseId: string) => void
}

const defaultProps = {
  upvoted: false,
  resolvedAt: undefined,
  onUpvoteFeedback: () => null,
  onPositiveResponseReaction: () => null,
  onNegativeResponseReaction: () => null,
}

function PublicFeedback({
  content,
  createdAt,
  resolved,
  resolvedAt,
  responses,
  upvoted,
  onUpvoteFeedback,
  onPositiveResponseReaction,
  onNegativeResponseReaction,
}: Props) {
  return (
    <div>
      <div className="border border-solid bg-primary-10% border-primary rounded shadow">
        <div className="flex items-start">
          <div className="flex-1 p-2 pl-4">
            <p className="mb-0 prose-sm prose">{content}</p>
            <div className="flex flex-row items-end mt-1 text-gray-500">
              <div className="text-xs text-gray-500">
                {resolved ? (
                  <FormattedMessage defaultMessage="Resolved on" id="joinSession.feedbackArea.resolvedAt" />
                ) : (
                  <FormattedMessage defaultMessage="Posted on" id="joinSession.feedbackArea.postedAt" />
                )}{' '}
                {dayjs(resolved ? resolvedAt : createdAt).format('DD.MM.YYYY HH:mm')}
              </div>
            </div>
          </div>
          <div className="flex-initial mt-1 mr-1">
            <Button
              className={twMerge('text-lg h-8 w-8 justify-center', upvoted && 'bg-uzh-blue-60 text-white')}
              disabled={resolved}
              onClick={onUpvoteFeedback}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faThumbsUp} />
              </Button.Icon>
            </Button>
          </div>
        </div>
      </div>
      {responses?.length > 0 && (
        <div>
          {responses.map((response) => (
            <div
              className="ml-4 flex flex-row pl-4 mt-2 border border-solid border-l-[5px] items-start bg-gray-50 py-1 rounded shadow-sm"
              key={response.id}
            >
              <div className="flex-1">
                <p className="mb-0 prose-sm prose">{response.content}</p>
                <div className="mt-1 text-xs text-gray-500">{dayjs(response.createdAt).format('DD.MM.YYYY HH:mm')}</div>
              </div>
              <div className="flex-initial">
                <Button
                  className={twMerge(
                    'text-lg h-7 w-7 justify-center mr-0.5',
                    response.positive && 'bg-uzh-blue-60 text-white'
                  )}
                  onClick={() => onPositiveResponseReaction(response.id)}
                >
                  <Button.Icon>
                    <FontAwesomeIcon icon={faThumbsUp} />
                  </Button.Icon>
                </Button>
                <Button
                  className={twMerge(
                    'text-lg h-7 w-7 justify-center',
                    response.negative && 'bg-uzh-blue-60 text-white'
                  )}
                  onClick={() => onNegativeResponseReaction(response.id)}
                >
                  <Button.Icon>
                    <FontAwesomeIcon icon={faQuestion} />
                  </Button.Icon>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

PublicFeedback.defaultProps = defaultProps

export default PublicFeedback
