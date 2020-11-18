import React, { useState } from 'react'
import _get from 'lodash/get'
import _sortBy from 'lodash/sortBy'
import { Button, Table, Confirm } from 'semantic-ui-react'
import { defineMessages, useIntl } from 'react-intl'
import EditTableRowForm from '../forms/EditTableRowForm'

const messages = defineMessages({
  confirmDeletion: {
    id: 'customizableTable.deleteEntity',
    defaultMessage: 'Delete Entity',
  },
  confirmDeletionDescription: {
    id: 'customizableTable.deleteConfirmation',
    defaultMessage: 'Are you sure that you want to delete the entity {activeId}?',
  },
  confirmAbortion: {
    id: 'customizableTable.abortSession',
    defaultMessage: 'Abort Session',
  },
  confirmAbortionDescription: {
    id: 'customizableTable.abortConfirmation',
    defaultMessage: 'Are you sure that you want to abort the session {activeId}?',
  },
})

interface Props {
  columns: {
    title: string // labels column
    attributeName: string // used to identify the correct attribute of the data object
    width?: any // describes the width of a column (optional)
    isEditable?: boolean // true if attribute is editable, false otherwise (must only be given if hasModification is true)
    isDropdown?: boolean // true if the form for editing is a dropdown, otherwise
    dropdownOptions?: { text: any; value: any }[] // must be given if isDropdown = true
  }[]
  data: any[]
  abortConfirmation?: boolean
  deletionConfirmation?: boolean
  editConfirmation?: boolean
  hasAbort?: boolean
  hasDeletion?: boolean
  hasModification?: boolean
  handleAbort?: (id: string, confirm: boolean) => Promise<void>
  handleDeletion?: (id: string, confirm: boolean) => Promise<void>
  handleModification?: (id: string, values: any, confirm: boolean) => Promise<void>
}

const defaultProps = {
  abortConfirmation: false,
  deletionConfirmation: false,
  editConfirmation: false,
  hasAbort: false,
  hasDeletion: false,
  hasModification: false,
}

const defaultColumnProperties = {
  width: 2,
  isEditable: false,
  isDropdown: false,
  dropdownOptions: [{ text: '', value: '' }],
}

function CustomizableTable({
  columns,
  data,
  abortConfirmation,
  deletionConfirmation,
  editConfirmation,
  hasAbort,
  hasDeletion,
  hasModification,
  handleAbort,
  handleDeletion,
  handleModification,
}: Props): React.ReactElement {
  const [sortBy, setSortBy] = useState(columns[0].attributeName)
  const [sortDirection, setSortDirection]: any = useState('descending')
  const [activeId, setActiveId] = useState(undefined)
  const [editableRow, setEditableRow] = useState(undefined)

  const intl = useIntl()

  const columnsWithDefaults = Object.assign(columns, defaultColumnProperties)

  const sortedData = sortDirection === 'ascending' ? _sortBy(data, sortBy) : _sortBy(data, sortBy).reverse()

  const onSort = (clickedColumn: string) => (): void => {
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
          {columnsWithDefaults.map(
            (column, key): React.ReactElement => (
              <Table.HeaderCell
                key={key.toString()}
                sorted={sortBy === column.attributeName ? sortDirection : null}
                width={column.width}
                onClick={onSort(column.attributeName)}
              >
                {column.title}
              </Table.HeaderCell>
            )
          )}
        </Table.Header>
        <Table.Body>
          {sortedData.map(
            (object, index): React.ReactElement =>
              (editableRow !== index && (
                <Table.Row className="displayRow" key={index.toString()}>
                  {columns.map(
                    (column, key): React.ReactElement => (
                      <Table.Cell key={key.toString()}>{_get(object, column.attributeName)}</Table.Cell>
                    )
                  )}
                  {(hasModification || hasDeletion || hasAbort) && (
                    <Table.Cell textAlign="right">
                      <div className="buttonArea">
                        {hasModification && (
                          <Button
                            icon="edit"
                            onClick={(): void => {
                              setEditableRow(index)
                            }}
                          />
                        )}
                        {hasAbort && (
                          <Button
                            icon="stop"
                            onClick={(): void => {
                              handleAbort(object.id, false)
                              setActiveId(object.id)
                            }}
                          />
                        )}
                        {hasDeletion && (
                          <Button
                            icon="trash"
                            onClick={(): void => {
                              handleDeletion(object.id, false)
                              setActiveId(object.id)
                            }}
                          />
                        )}
                      </div>
                    </Table.Cell>
                  )}
                </Table.Row>
              )) || (
                <Table.Row className="editRow" key={'edit'}>
                  <EditTableRowForm
                    columns={columns}
                    data={object}
                    editConfirmation={editConfirmation}
                    handleModification={handleModification}
                    onDiscard={(): void => setEditableRow(undefined)}
                    onSuccessfulModification={(): void => {
                      setEditableRow(undefined)
                    }}
                  />
                </Table.Row>
              )
          )}
        </Table.Body>
      </Table>
      <Confirm
        cancelButton={intl.formatMessage({ id: 'common.button.back' })}
        confirmButton={intl.formatMessage(messages.confirmDeletion)}
        content={intl.formatMessage(messages.confirmDeletionDescription, { activeId })}
        open={deletionConfirmation}
        onCancel={(): Promise<void> => handleDeletion(activeId, false)}
        onConfirm={(): Promise<void> => handleDeletion(activeId, true)}
      />
      <Confirm
        cancelButton={intl.formatMessage({ id: 'common.button.back' })}
        confirmButton={intl.formatMessage(messages.confirmAbortion)}
        content={intl.formatMessage(messages.confirmAbortionDescription, { activeId })}
        open={abortConfirmation}
        onCancel={(): Promise<void> => handleAbort(activeId, false)}
        onConfirm={(): Promise<void> => handleAbort(activeId, true)}
      />
      <style jsx>
        {`
          .buttonArea {
            display: flex;
            flex-direction: row-reverse;
          }
        `}
      </style>
    </div>
  )
}

CustomizableTable.defaultProps = defaultProps

export default CustomizableTable
