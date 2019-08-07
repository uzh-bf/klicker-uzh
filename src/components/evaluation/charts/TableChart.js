import React from 'react'
import PropTypes from 'prop-types'
import _sortBy from 'lodash/sortBy'
import { Mutation } from 'react-apollo'
import { Button, Table } from 'semantic-ui-react'
import { compose, withStateHandlers, withProps } from 'recompose'

import { QUESTION_GROUPS } from '../../../constants'
import { SessionEvaluationQuery, DeleteResponseMutation } from '../../../graphql'

const propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      correct: PropTypes.bool.isRequired,
      count: PropTypes.number.isRequired,
      percentage: PropTypes.number.isRequired,
      value: PropTypes.string.isRequired,
    })
  ),
  handleSort: PropTypes.func.isRequired,
  instanceId: PropTypes.string.isRequired,
  isPublic: PropTypes.bool,
  isSolutionShown: PropTypes.bool,
  questionType: PropTypes.string.isRequired,
  sessionId: PropTypes.string.isRequired,
  sortBy: PropTypes.string.isRequired,
  sortDirection: PropTypes.string.isRequired,
}

const defaultProps = {
  data: [],
  isPublic: true,
  isSolutionShown: false,
}

function TableChart({
  sortDirection,
  sortBy,
  sessionId,
  instanceId,
  data,
  isSolutionShown,
  questionType,
  isPublic,
  handleSort,
}) {
  return (
    <div className="tableChart">
      <Mutation mutation={DeleteResponseMutation}>
        {deleteResponse => (
          <Table sortable striped>
            <Table.Header>
              <Table.HeaderCell
                collapsing
                sorted={sortBy === 'count' ? sortDirection : null}
                onClick={handleSort('count')}
              >
                Count
              </Table.HeaderCell>
              <Table.HeaderCell sorted={sortBy === 'value' ? sortDirection : null} onClick={handleSort('value')}>
                Value
              </Table.HeaderCell>

              {QUESTION_GROUPS.WITH_PERCENTAGES.includes(questionType) && (
                <Table.HeaderCell
                  collapsing
                  sorted={sortBy === 'percentage' ? sortDirection : null}
                  onClick={handleSort('percentage')}
                >
                  %
                </Table.HeaderCell>
              )}

              {isSolutionShown && (
                <Table.HeaderCell
                  collapsing
                  sorted={sortBy === 'correct' ? sortDirection : null}
                  onClick={handleSort('correct')}
                >
                  T/F
                </Table.HeaderCell>
              )}

              {!isPublic && QUESTION_GROUPS.FREE.includes(questionType) && (
                <Table.HeaderCell collapsing>Actions</Table.HeaderCell>
              )}
            </Table.Header>
            <Table.Body>
              {data.map(({ correct, count, percentage, value }) => (
                <Table.Row key={value}>
                  <Table.Cell>{count}</Table.Cell>
                  <Table.Cell>{value}</Table.Cell>

                  {QUESTION_GROUPS.WITH_PERCENTAGES.includes(questionType) && <Table.Cell>{percentage}</Table.Cell>}

                  {isSolutionShown && (
                    <Table.Cell>{typeof correct !== 'undefined' && (correct ? 'T' : 'F')}</Table.Cell>
                  )}

                  {!isPublic && QUESTION_GROUPS.FREE.includes(questionType) && (
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
                              response: String(value),
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
        }
      `}</style>
    </div>
  )
}

TableChart.propTypes = propTypes
TableChart.defaultProps = defaultProps

export default compose(
  withStateHandlers(
    {
      sortBy: 'count',
      sortDirection: 'descending',
    },
    {
      handleSort: ({ sortBy, sortDirection }) => clickedColumn => {
        // if the same column as previously active is clicked, reverse the sort direction
        if (sortBy === clickedColumn) {
          return { sortDirection: sortDirection === 'ascending' ? 'descending' : 'ascending' }
        }

        // otherwise update the property we sort by
        return { sortBy: clickedColumn }
      },
    }
  ),
  withProps(({ data, sortBy, sortDirection, handleSort }) => ({
    data: sortDirection === 'ascending' ? _sortBy(data, sortBy) : _sortBy(data, sortBy).reverse(),
    handleSort: clickedColumn => () => handleSort(clickedColumn),
  }))
)(TableChart)
