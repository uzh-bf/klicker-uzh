import React from 'react'
import { Table, Icon, Button } from 'semantic-ui-react'
import dayjs from 'dayjs'
import clsx from 'clsx'

interface Props {
  feedbacks: any[]
}

function FeedbackTableChart({ feedbacks }: Props): React.ReactElement {
  return (
    <div>
      {feedbacks.map(
        (feedback: any): React.ReactElement => (
          <FeedbackBlock feedback={feedback} key={feedback.id} />
        )
      )}
    </div>
  )
}

interface FeedbackBlockProps {
  feedback: any
}
function FeedbackBlock({ feedback }: FeedbackBlockProps): React.ReactElement {
  return (
    <div>
      <div className="flex pl-4 p-2 border border-solid bg-primary-10% border-primary rounded shadow mt-4 first:mt-0">
        <div className="flex-1 no-page-break-inside">
          <div className="mb-0 text-sm print:text-base">{feedback.content}</div>
          <div className="flex flex-row items-end mt-2 text-xs text-gray-500 print:text-sm">
            <div>{dayjs(feedback.createdAt).format('DD.MM.YYYY HH:mm')}</div>
            <div className="ml-8" />
          </div>
        </div>
        <div className="flex flex-col items-end justify-between flex-initial !items-top print:hidden">
          <div className="text-base text-gray-500">
            {feedback.votes} <Icon name="thumbs up outline" />
          </div>
        </div>
      </div>

      <div className="pl-4 mt-2 print:p-2 print:pr-0">
        <div>
          {feedback.responses.map((response: any) => (
            <div
              className="flex flex-row pl-4 mt-2 border border-solid border-l-[5px] print:border-l-[10px] first:mt-0 last:mb-2 items-start bg-gray-50 py-1 print:pr-0 rounded shadow-sm no-page-break-inside"
              key={response.createdAt}
            >
              <div className="flex-1">
                <p className="mb-0 text-sm prose print:text-base">{response.content}</p>
                <div className="mt-1 text-xs text-gray-500 print:text-sm">
                  {dayjs(response.createdAt).format('DD.MM.YYYY HH:mm')}
                </div>
              </div>
              <div className="flex flex-row items-center flex-initial print:hidden">
                <div className={clsx('text-gray-500')}>
                  {response.positiveReactions} <Icon name="thumbs up outline" />
                </div>
                <div className={clsx('ml-2', 'text-gray-500')}>
                  {response.negativeReactions} <Icon name="question" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default FeedbackTableChart
