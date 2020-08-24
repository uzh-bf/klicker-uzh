import React from 'react'
import { Table } from 'semantic-ui-react'

interface Props {
  feedback: any[]
}

function FeedbackTableChart({ feedback }: Props): React.ReactElement {
  return (
    <div className="tableChart">
      <Table striped>
        <Table.Header>
          <Table.HeaderCell>Feedback</Table.HeaderCell>
        </Table.Header>
        <Table.Body>
          {feedback.map(
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
