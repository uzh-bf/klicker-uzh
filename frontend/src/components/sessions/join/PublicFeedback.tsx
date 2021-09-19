import dayjs from 'dayjs'
import { Icon, Button } from 'semantic-ui-react'
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
              <div className="text-sm text-gray-500">{dayjs(createdAt).format('DD.MM.YYYY HH:mm')}</div>
              <div className="ml-4">
                {resolved ? <Icon name="check" size="small" /> : <Icon name="discussions" size="small" />}
                {resolved && resolvedAt && dayjs(resolvedAt).format('DD.MM.YYYY HH:mm')}
              </div>
            </div>
          </div>
          <div className="flex-initial mt-1 mr-1">
            <Button
              compact
              basic={!upvoted}
              className="text-xl text-gray-500 !mr-0"
              color={upvoted ? 'blue' : undefined}
              disabled={resolved}
              icon={upvoted ? 'thumbs up' : 'thumbs up outline'}
              size="small"
              onClick={onUpvoteFeedback}
            />
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
                <div className="mt-1 text-sm text-gray-500">{dayjs(response.createdAt).format('DD.MM.YYYY HH:mm')}</div>
              </div>
              <div className="flex-initial">
                <Button
                  compact
                  basic={!response.positive}
                  color={response.positive ? 'blue' : undefined}
                  icon={response.positive ? 'thumbs up' : 'thumbs up outline'}
                  size="small"
                  onClick={() => onPositiveResponseReaction(response.id)}
                />
                <Button
                  compact
                  basic={!response.negative}
                  color={response.negative ? 'blue' : undefined}
                  icon="question"
                  size="small"
                  onClick={() => onNegativeResponseReaction(response.id)}
                />
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
