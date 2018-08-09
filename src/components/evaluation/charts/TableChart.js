import React from 'react'
import PropTypes from 'prop-types'
import { Mutation } from 'react-apollo'
import { Button, Table } from 'semantic-ui-react'

import { QUESTION_GROUPS } from '../../../constants'
import { DeleteResponseMutation } from '../../../graphql'

const propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      count: PropTypes.number.isRequired,
      percentage: PropTypes.number.isRequired,
      value: PropTypes.string.isRequired,
    })
  ),
  instanceId: PropTypes.string.isRequired,
  isSolutionShown: PropTypes.bool,
  questionType: PropTypes.string.isRequired,
}

const defaultProps = {
  data: [],
  isSolutionShown: false,
}

function TableChart({ instanceId, data, isSolutionShown, questionType }) {
  return (
    <div className="tableChart">
      <Mutation mutation={DeleteResponseMutation}>
        {deleteResponse => (
          <Table striped>
            <Table.Header>
              <Table.HeaderCell collapsing>Count</Table.HeaderCell>
              <Table.HeaderCell>Value</Table.HeaderCell>

              {QUESTION_GROUPS.WITH_PERCENTAGES.includes(questionType) && (
                <Table.HeaderCell collapsing>%</Table.HeaderCell>
              )}

              {isSolutionShown && <Table.HeaderCell collapsing>T/F</Table.HeaderCell>}

              {QUESTION_GROUPS.FREE.includes(questionType) && <Table.HeaderCell collapsing>Actions</Table.HeaderCell>}
            </Table.Header>
            <Table.Body>
              {data.map(({ correct, count, percentage, value }) => (
                <Table.Row key={value}>
                  <Table.Cell>{count}</Table.Cell>
                  <Table.Cell>{value}</Table.Cell>

                  {QUESTION_GROUPS.WITH_PERCENTAGES.includes(questionType) && <Table.Cell>{percentage}</Table.Cell>}

                  {isSolutionShown && typeof correct !== 'undefined' && <Table.Cell>{correct ? 'T' : 'F'}</Table.Cell>}

                  <Table.Cell>
                    <Button
                      icon="trash"
                      onClick={async () => {
                        await deleteResponse({
                          optimisticResponse: {
                            __typename: 'Mutation',
                            deleteResponse: 'RESPONSE_DELETED',
                          },
                          update: () => {},
                          variables: {
                            instanceId,
                            response: value,
                          },
                        })
                      }}
                    />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Mutation>

      <style jsx>{`
        .tableChart {
          width: 100%;
        }
      `}</style>
    </div>
  )
}

TableChart.propTypes = propTypes
TableChart.defaultProps = defaultProps

export default TableChart
