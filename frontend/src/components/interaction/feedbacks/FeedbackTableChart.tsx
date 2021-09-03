import React from 'react'
import { Table, Icon } from 'semantic-ui-react'

interface Props {
  feedbacks: any[]
}

// feedback element has attributes content, id and votes BUT NO ANSWER ATTRIBUTE
function FeedbackTableChart({ feedbacks }: Props): React.ReactElement {
  return (
    <div className="tableChart">
      <Table striped>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Feedback</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {feedbacks.map(
            (element: any): React.ReactElement => (
              <Table.Row>
                <Table.Cell>
                  {element.content}{' '}
                  <div className="float-right">
                    {element.votes} <Icon name="thumbs up outline" />
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
      `}</style>
    </div>
  )
}

interface ResponseProps {
  response: any
}
function Response({ response }: ResponseProps): React.ReactElement {
  return (
    <>
      <div className="mt-4 ml-4 p-2 border-solid border-2 border-gray-400 rounded-md">
        {response.content}
        <div className="ml-4 float-right float-top">
          {response.positiveReactions} <Icon name="thumbs up outline" />
          {response.negativeReactions} <Icon name="question" />
        </div>
      </div>
    </>
  )
}

export default FeedbackTableChart
