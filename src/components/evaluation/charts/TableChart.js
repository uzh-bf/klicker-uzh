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
  sessionId: PropTypes.string.isRequired,
}

const defaultProps = {
  data: [],
  isPublic: true,
  isSolutionShown: false,
}

function TableChart({ sessionId, instanceId, data, isSolutionShown, questionType, isPublic }) {
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

                  {!isPublic &&
                    QUESTION_GROUPS.FREE.includes(questionType) && (
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

                                // read the session from cache
                                const { session } = cache.readQuery({
                                  query: SessionEvaluationQuery,
                                  variables: { sessionId },
                                })

                                // perform cache updates
                                cache.writeQuery({
                                  data: {
                                    session: {
                                      ...session,
                                      blocks: session.blocks.map(block => {
                                        // find the index of the relevant instance
                                        const instanceIndex = block.instances.findIndex(
                                          instance => instance.id === instanceId
                                        )

                                        // if the instance was in this block
                                        // perform result updates
                                        if (instanceIndex >= 0) {
                                          const updatedBlock = block

                                          // decrement the number of responses and remove the result
                                          updatedBlock.instances[instanceIndex].results.FREE.totalResponses -= 1
                                          updatedBlock.instances[instanceIndex].results.FREE = updatedBlock.instances[
                                            instanceIndex
                                          ].results.FREE.filter(response => `${response.value}` !== `${value}`)

                                          return updatedBlock
                                        }

                                        return block
                                      }),
                                    },
                                  },
                                  query: SessionEvaluationQuery,
                                  variables: {
                                    sessionId,
                                  },
                                })
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
