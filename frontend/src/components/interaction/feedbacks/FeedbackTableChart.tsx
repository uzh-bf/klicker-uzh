import React from 'react'
import { Table, Icon } from 'semantic-ui-react'
import { Button } from 'semantic-ui-react'
import dayjs from 'dayjs'
import clsx from 'clsx'

interface Props {
  feedbacks: any[]
}

function FeedbackTableChart({ feedbacks }: Props): React.ReactElement {
  return (
    <div>
      <div className="text-lg font-bold mb-6 print:hidden">
        Feedbacks
        <Button basic className="float-right !m-0" icon="print" onClick={() => window.print()} />
      </div>
      <div className="text-xl font-bold mb-4 bg-red-200 hidden print:block">Feedbacks</div>

      {feedbacks.map(
        (feedback: any): React.ReactElement => (
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
      )}
    </div>
  )
  /* <div className="tableChart">
      <Table striped>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>
              Feedback <Button basic className="!mr-2 float-right" icon="print" onClick={() => window.print()} />
            </Table.HeaderCell>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {feedbacks.map(
            (element: any): React.ReactElement => (
              <Table.Row>
                <Table.Cell>
                  <div className="flex">
                    <div className="flex-1">{element.content}</div>
                    <div className="float-right ml-6">
                      {element.votes} <Icon name="thumbs up outline" />
                    </div>
                  </div>
                  {element.responses
                    ? element.responses.map((response: any) => <Response response={response} />)
                    : 'No answer available'}
                </Table.Cell>
              </Table.Row>
            )
          )}
        </Table.Body>
      </Table>

      <style jsx>{`
        .tableChart {
          width: 100%;
        }
        @media print {
          @page {
            size: landscape;
          }
        }
      `}</style>
      </div> */
}

interface ResponseProps {
  response: any
}
function Response({ response }: ResponseProps): React.ReactElement {
  return (
    <>
      <div className="flex mt-4 ml-4 p-2 border-solid border-2 border-gray-400 rounded-md">
        <div className="flex-1">{response.content}</div>
        <div className="ml-6 float-right float-top">
          {response.positiveReactions} <Icon name="thumbs up outline" />
          {response.negativeReactions} <Icon name="question" />
        </div>
      </div>
    </>
  )
}

export default FeedbackTableChart
