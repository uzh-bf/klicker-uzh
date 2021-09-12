import React from 'react'
import { Table, Icon } from 'semantic-ui-react'
import { Button } from 'semantic-ui-react'
import dayjs from 'dayjs'
import clsx from 'clsx'

interface Props {
  feedbacks: any[]
}

function FeedbackTableChart({ feedbacks }: Props): React.ReactElement {
  const simpleFeedbackAmount = feedbacks.filter((feedback: any) => feedback.resolved == false).length
  const answeredQuestionsAmount = feedbacks.filter((feedback: any) => feedback.resolved == true).length

  return (
    <div>
      {simpleFeedbackAmount > 0 && (
        <>
          <div className="text-lg font-bold mb-6 print:hidden">
            Feedbacks / Questions
            <Button basic className="float-right !m-0" icon="print" onClick={() => window.print()} />
          </div>
          <div className="text-xl font-bold mb-4 bg-red-200 hidden print:block">Feedbacks / Questions</div>
        </>
      )}
      {feedbacks
        .filter((feedback: any) => feedback.resolved == false)
        .map(
          (feedback: any): React.ReactElement => (
            <>
              <FeedbackBlock feedback={feedback} />
            </>
          )
        )}
      {answeredQuestionsAmount > 0 && (
        <>
          <div className={clsx('text-lg font-bold mb-6 print:hidden', simpleFeedbackAmount > 0 && 'mt-4')}>
            Answered Questions
            {simpleFeedbackAmount == 0 && (
              <Button basic className="float-right !m-0" icon="print" onClick={() => window.print()} />
            )}
          </div>
          <div
            className={clsx('text-xl font-bold mb-4 bg-red-200 hidden print:block', simpleFeedbackAmount > 0 && 'mt-6')}
          >
            Answered Questions
          </div>
        </>
      )}
      {feedbacks
        .filter((feedback: any) => feedback.resolved == true)
        .map(
          (feedback: any): React.ReactElement => (
            <FeedbackBlock feedback={feedback} />
          )
        )}
    </div>

    /* Simplified View
    <div>
      <div className="text-lg font-bold mb-6 print:hidden">
        Feedbacks / Questions
        <Button basic className="float-right !m-0" icon="print" onClick={() => window.print()} />
      </div>
      <div className="text-xl font-bold mb-4 bg-red-200 hidden print:block">Feedbacks / Questions</div>

      {feedbacks.map(
        (feedback: any): React.ReactElement => (
          <>
            <FeedbackBlock feedback={feedback} />
          </>
        )
      )}
    </div>*/
  )
}

interface FeedbackBlockProps {
  feedback: any
}
function FeedbackBlock({ feedback }: FeedbackBlockProps): React.ReactElement {
  return (
    <div>
      <div className="flex pl-4 p-2 border border-solid bg-primary-10% border-primary rounded shadow mt-2">
        <div className="flex-1 no-page-break-inside">
          <div className="mb-0 text-sm print:text-base">{feedback.content}</div>
          <div className="flex flex-row items-end mt-2 text-gray-500 text-xs print:text-sm">
            <div>{dayjs(feedback.createdAt).format('DD.MM.YYYY HH:mm')}</div>
            <div className="ml-8"></div>
          </div>
        </div>
        <div className="flex flex-col items-end justify-between flex-initial !items-top print:hidden">
          <div className="text-base text-gray-500">
            {feedback.votes} <Icon name="thumbs up outline" />
          </div>
        </div>
      </div>

      <div className={'py-4 pl-4 print:p-2 print:pr-0'}>
        <div>
          {feedback.responses.map((response: any) => (
            <div
              className="flex flex-row pl-4 mt-2 border border-solid border-l-[5px] print:border-l-[10px] first:mt-0 last:mb-2 items-start bg-gray-50 py-1 print:pr-0 rounded shadow-sm no-page-break-inside"
              key={response.createdAt}
            >
              <div className="flex-1">
                <p className="mb-0 prose text-sm print:text-base">{response.content}</p>
                <div className="mt-1 text-xs print:text-sm text-gray-500">
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
