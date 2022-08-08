import React, { useState } from 'react'
import _sortBy from 'lodash/sortBy'
import { useMutation } from '@apollo/client'
import { Table, Icon } from 'semantic-ui-react'
import { twMerge } from 'tailwind-merge'
import { Button } from '@uzh-bf/design-system'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrashCan } from '@fortawesome/free-regular-svg-icons'

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

  const onSort =
    (clickedColumn: string): any =>
    (): void => {
      // if the same column as previously active is clicked, reverse the sort direction
      if (sortBy === clickedColumn) {
        setSortDirection(sortDirection === 'ascending' ? 'descending' : 'ascending')
      }

      // otherwise update the property we sort by
      setSortBy(clickedColumn)
    }

  return (
    <div className="w-full h-full overflow-y-scroll">
      <Table sortable striped className="!border-none">
        <Table.Header>
          <Table.HeaderCell
            collapsing
            className={twMerge('p-1 cursor-pointer', sortBy === 'count' && 'bg-gray-100')}
            onClick={onSort('count')}
          >
            Count
            {sortBy === 'count' &&
              (sortDirection === 'ascending' ? <Icon name="angle up" /> : <Icon name="angle down" />)}
          </Table.HeaderCell>
          <Table.HeaderCell
            className={twMerge('p-1 cursor-pointer', sortBy === 'value' && 'bg-gray-100')}
            onClick={onSort('value')}
          >
            Value
            {sortBy === 'value' &&
              (sortDirection === 'ascending' ? <Icon name="angle up" /> : <Icon name="angle down" />)}
          </Table.HeaderCell>

          {QUESTION_GROUPS.WITH_PERCENTAGES.includes(questionType) && (
            <Table.HeaderCell
              collapsing
              className={twMerge('p-1 cursor-pointer', sortBy === 'percentage' && 'bg-gray-100')}
              onClick={onSort('percentage')}
            >
              %
              {sortBy === 'percentage' &&
                (sortDirection === 'ascending' ? <Icon name="angle up" /> : <Icon name="angle down" />)}
            </Table.HeaderCell>
          )}

          {isSolutionShown && (
            <Table.HeaderCell
              collapsing
              className={twMerge('p-1 cursor-pointer', sortBy === 'correct' && 'bg-gray-100')}
              onClick={onSort('correct')}
            >
              T/F
              {sortBy === 'correct' &&
                (sortDirection === 'ascending' ? <Icon name="angle up" /> : <Icon name="angle down" />)}
            </Table.HeaderCell>
          )}

          {!isPublic && QUESTION_GROUPS.FREE.includes(questionType) && (
            <Table.HeaderCell collapsing className="p-1 noPrint">
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
                            // @ts-ignore
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
                    >
                      <Button.Icon>
                        <FontAwesomeIcon icon={faTrashCan} />
                      </Button.Icon>
                    </Button>
                  </Table.Cell>
                )}
              </Table.Row>
            )
          )}
        </Table.Body>
      </Table>
    </div>
  )
}

TableChart.defaultProps = defaultProps

export default TableChart
