import { useMutation } from '@apollo/client'
import _sortBy from 'lodash/sortBy'
import React, { useState } from 'react'
import { Button, Table } from 'semantic-ui-react'
import { QUESTION_GROUPS } from '../../../constants'
import DeleteResponseMutation from '../../../graphql/mutations/DeleteResponseMutation.graphql'
import SessionEvaluationQuery from '../../../graphql/queries/SessionEvaluationQuery.graphql'

interface Props {
  sessionId: string
  instanceId: string
  data?: {
    correct?: boolean
    count: number
    percentage: number
    value: string
  }
  isSolutionShown?: boolean
  questionType: string
  isPublic?: boolean
}

const defaultProps = {
  data: [],
  isPublic: true,
  isSolutionShown: false,
}

function TableChart({
  sessionId,
  instanceId,
  data,
  isSolutionShown,
  questionType,
  isPublic,
}: Props): React.ReactElement {
  const [sortBy, setSortBy] = useState('count')
  const [sortDirection, setSortDirection]: any = useState('descending')

  const [deleteResponse] = useMutation(DeleteResponseMutation)

  const sortedData = sortDirection === 'ascending' ? _sortBy(data, sortBy) : _sortBy(data, sortBy).reverse()

  const onSort = (clickedColumn: string): any => (): void => {
    // if the same column as previously active is clicked, reverse the sort direction
    if (sortBy === clickedColumn) {
      setSortDirection(sortDirection === 'ascending' ? 'descending' : 'ascending')
    }

    // otherwise update the property we sort by
    setSortBy(clickedColumn)
  }

  return (
    <div className="tableChart">
      <Table sortable striped>
        <Table.Header>
          <Table.HeaderCell collapsing sorted={sortBy === 'count' ? sortDirection : null} onClick={onSort('count')}>
            Count
          </Table.HeaderCell>
          <Table.HeaderCell sorted={sortBy === 'value' ? sortDirection : null} onClick={onSort('value')}>
            Value
          </Table.HeaderCell>

          {QUESTION_GROUPS.WITH_PERCENTAGES.includes(questionType) && (
            <Table.HeaderCell
              collapsing
              sorted={sortBy === 'percentage' ? sortDirection : null}
              onClick={onSort('percentage')}
            >
              %
            </Table.HeaderCell>
          )}

          {isSolutionShown && (
            <Table.HeaderCell
              collapsing
              sorted={sortBy === 'correct' ? sortDirection : null}
              onClick={onSort('correct')}
            >
              T/F
            </Table.HeaderCell>
          )}

          {!isPublic && QUESTION_GROUPS.FREE.includes(questionType) && (
            <Table.HeaderCell collapsing className="noPrint">
              Actions
            </Table.HeaderCell>
          )}
        </Table.Header>
        <Table.Body>
          {sortedData.map(
            ({ correct, count, percentage, value }: any): React.ReactElement => (
              <Table.Row key={value}>
                <Table.Cell>{count}</Table.Cell>
                <Table.Cell>{value}</Table.Cell>

                {QUESTION_GROUPS.WITH_PERCENTAGES.includes(questionType) && <Table.Cell>{percentage}</Table.Cell>}

                {isSolutionShown && <Table.Cell>{typeof correct !== 'undefined' && (correct ? 'T' : 'F')}</Table.Cell>}

                {!isPublic && QUESTION_GROUPS.FREE.includes(questionType) && (
                  <Table.Cell className="noPrint">
                    <Button
                      icon="trash"
                      onClick={async (): Promise<void> => {
                        await deleteResponse({
                          optimisticResponse: {
                            __typename: 'Mutation',
                            deleteResponse: 'RESPONSE_DELETED',
                          },
                          update: (cache, { data: responseData }): void => {
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
                                  blocks: session.blocks.map((block): any => {
                                    // find the index of the relevant instance
                                    const instanceIndex = block.instances.findIndex(
                                      (instance): boolean => instance.id === instanceId
                                    )

                                    // if the instance was in this block
                                    // perform result updates
                                    if (instanceIndex >= 0) {
                                      const updatedBlock = block

                                      // decrement the number of responses and remove the result
                                      updatedBlock.instances[instanceIndex].results.FREE.totalResponses -= 1
                                      updatedBlock.instances[instanceIndex].results.FREE = updatedBlock.instances[
                                        instanceIndex
                                      ].results.FREE.filter((response): boolean => `${response.value}` !== `${value}`)

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
            )
          )}
        </Table.Body>
      </Table>

      <style jsx>{`
        .tableChart {
          width: 100%;
          height: 100%;

          @media screen {
            overflow-y: auto;
          }
        }
      `}</style>
    </div>
  )
}

TableChart.defaultProps = defaultProps

export default TableChart
