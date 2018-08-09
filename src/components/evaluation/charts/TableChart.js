import React from 'react'
import PropTypes from 'prop-types'
import { Mutation } from 'react-apollo'
import { Button, Table } from 'semantic-ui-react'

import { QUESTION_GROUPS } from '../../../constants'
import { SessionEvaluationQuery, DeleteResponseMutation } from '../../../graphql'

const propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      count: PropTypes.number.isRequired,
      percentage: PropTypes.number.isRequired,
      value: PropTypes.string.isRequired,
    })
  ),
  instanceId: PropTypes.string.isRequired,
  isPublic: PropTypes.bool,
  isSolutionShown: PropTypes.bool,
  questionType: PropTypes.string.isRequired,
}

const defaultProps = {
  data: [],
  isPublic: true,
  isSolutionShown: false,
}

function TableChart({ instanceId, data, isSolutionShown, questionType, isPublic }) {
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

              {!isPublic &&
                QUESTION_GROUPS.FREE.includes(questionType) && <Table.HeaderCell collapsing>Actions</Table.HeaderCell>}
            </Table.Header>
            <Table.Body>
              {data.map(({ correct, count, percentage, value }) => (
                <Table.Row key={value}>
                  <Table.Cell>{count}</Table.Cell>
                  <Table.Cell>{value}</Table.Cell>

                  {QUESTION_GROUPS.WITH_PERCENTAGES.includes(questionType) && <Table.Cell>{percentage}</Table.Cell>}

                  {isSolutionShown && typeof correct !== 'undefined' && <Table.Cell>{correct ? 'T' : 'F'}</Table.Cell>}

                  {!isPublic && (
                    <Table.Cell>
                      <Button
                        icon="trash"
                        onClick={async () => {
                          await deleteResponse({
                            optimisticResponse: {
                              __typename: 'Mutation',
                              deleteResponse: 'RESPONSE_DELETED',
                            },
                            update: (cache, { data: responseData }) => {
                              if (responseData.deleteResponse !== 'RESPONSE_DELETED') {
                                return
                              }

                              const { session } = cache.readQuery({ query: SessionEvaluationQuery })
                              console.log(session)
                              /* cache.writeQuery({
                              data: {
                                sessions: sessions.filter(session => session.id !== id),
                              },
                              query: SessionListQuery,
                            }) */
                            },
                            variables: {
                              instanceId,
                              response: value,
                            },
                          })
                        }}
                      />
                    </Table.Cell>
                  )}
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Mutation>

      <style jsx>{`
        .tableChart {
          width: 100%;

          :global(tbody) {
            overflow-y: auto;
          }
        }
      `}</style>
    </div>
  )
}

TableChart.propTypes = propTypes
TableChart.defaultProps = defaultProps

export default TableChart
