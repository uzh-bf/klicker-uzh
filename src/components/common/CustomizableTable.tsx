import React, { useState } from 'react'
import _sortBy from 'lodash/sortBy'
import { Button, Table, Confirm } from 'semantic-ui-react'
import EditTableRowForm from '../forms/EditTableRowForm'

interface Props {
  columns: { title: string, attributeName: string, width?: any }[],
  data: any [], 
  deletionConfirmation?: boolean,
  editConfirmation?: boolean,
  hasDeletion?: boolean,
  hasModification?: boolean,
  handleDeletion?: (id: string, confirm: boolean) => Promise<void>,
  handleModification?: (id: string, values : any, confirm: boolean) => Promise<void>,
}

const defaultProps = {
  deletionConfirmation: false,
  hasDeletion: false,
  hasModification: false,
}

function CustomizableTable({
  columns, 
  data, 
  deletionConfirmation, 
  editConfirmation, 
  hasDeletion, 
  hasModification, 
  handleDeletion, 
  handleModification
} : Props ) : React.ReactElement {

    const [sortBy, setSortBy] = useState(columns[0].attributeName)
    const [sortDirection, setSortDirection] : any = useState('descending')
    const [activeId, setActiveId] = useState(undefined)
    const [editableRow, setEditableRow] = useState(undefined)

    const sortedData = sortDirection === 'ascending' ? _sortBy(data, sortBy) : _sortBy(data, sortBy).reverse()

    const onSort = (clickedColumn: string): Function => (): void => {
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
                {
                  columns.map((column) : React.ReactElement => (
                      <Table.HeaderCell sorted={sortBy === column.attributeName ? sortDirection : null} width={column.width} onClick={onSort(column.attributeName)}  >
                        {column.title}
                      </Table.HeaderCell>                 
                  ))
                  }
              </Table.Header>
              <Table.Body>
                {
                  sortedData.map(( object, index ) : React.ReactElement => (
                    editableRow !== index && (
                      <Table.Row className="displayRow">
                          {columns.map(( column ): React.ReactElement => (
                            <Table.Cell>
                              {object[column.attributeName]}
                            </Table.Cell>
                          ))}
                          {(hasModification || hasDeletion) && (
                            <Table.Cell textAlign="right">
                              {hasModification && <Button icon="edit" onClick={() : void => {
                                setEditableRow(index)
                              }}/>}
                              {hasDeletion && <Button icon="trash" onClick={() : void => {
                                handleDeletion(object.id, false)
                                setActiveId(object.id)
                                }}/>}
                            </Table.Cell>)}
                        </Table.Row>) || (
                        <Table.Row className="editRow">
                          <EditTableRowForm
                            columns={columns}
                            data={object}
                            editConfirmation={editConfirmation}
                            handleModification={handleModification}
                            onDiscard={() : void => setEditableRow(undefined)}
                            onSuccessfulModification={() : void => {
                              setEditableRow(undefined)
                            }} 
                          />
                        </Table.Row>
                      )
                  ))
                }
              </Table.Body>
            </Table>
            <Confirm 
              cancelButton={'Go Back'}
              confirmButton={'Delete User'}
              content={`Are you sure that you want to delete the user ${activeId}?`}
              open={deletionConfirmation}
              onCancel={() : Promise<void> => handleDeletion(activeId, false)}
              onConfirm={() : Promise<void>  => handleDeletion(activeId, true)}
            />
        </div>
      )
}

CustomizableTable.defaultProps = defaultProps

export default CustomizableTable
