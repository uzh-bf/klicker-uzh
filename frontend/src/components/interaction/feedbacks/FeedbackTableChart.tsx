import React from 'react'
import { Table } from 'semantic-ui-react'

interface Props {
  feedbacks: any[]
}

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
                <Table.Cell>{element.content}</Table.Cell>
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
export default FeedbackTableChart
