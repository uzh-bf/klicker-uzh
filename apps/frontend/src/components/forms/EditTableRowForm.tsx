import React, { useState } from 'react'
import { Formik } from 'formik'
import { object } from 'yup'
import { Confirm, Table, Dropdown } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import { Button } from '@uzh-bf/design-system'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFloppyDisk, faRotateLeft } from '@fortawesome/free-solid-svg-icons'

import FormikInput from './components/FormikInput'
import validationSchema from './common/validationSchema'

function ConfirmationContent({
  columns,
  initialValues,
  values,
}: {
  columns: any
  initialValues: any
  values: any
}): React.ReactElement {
  return (
    <p className="content">
      <h3>
        <FormattedMessage defaultMessage="The following changes will be made" id="forms.editTableRow.changeLeading" />:
        {'\n'}
      </h3>
      {columns.map((column) =>
        initialValues[column.attributeName] !== values[column.attributeName] ? (
          <p key={column.title}>
            {'\n'}
            {column.title}: {initialValues[column.attributeName]} -&gt; {values[column.attributeName]}
          </p>
        ) : (
          ''
        )
      )}
      <style jsx>
        {`
          @import 'src/theme';
          .content {
            padding: 1rem;
          }
        `}
      </style>
    </p>
  )
}

interface Props {
  data: any
  columns: any[]
  editConfirmation: boolean
  handleModification: (id: string, values: any, confirm: boolean) => Promise<void>
  onDiscard: () => void
  onSuccessfulModification: () => void
}

function EditTableRowForm({
  data,
  columns,
  editConfirmation,
  handleModification,
  onDiscard,
  onSuccessfulModification,
}: Props): React.ReactElement {
  const [activeRole, setActiveRole] = useState(data.role)

  const initialValues = {
    role: undefined,
  }
  columns.forEach((column) => {
    initialValues[column.attributeName] = data[column.attributeName]
  })

  return (
    <Formik
      initialValues={initialValues}
      render={({
        values,
        errors,
        touched,
        handleChange,
        handleBlur,
        isValid,
        dirty,
        setFieldValue,
      }): React.ReactElement => (
        <>
          {columns.map(
            (column, key): React.ReactElement =>
              (column.isEditable && !column.isDropdown && (
                <Table.Cell key={column.attributeName} verticalAlign={'top'} width={column.width}>
                  <FormikInput
                    required
                    error={errors[column.attributeName]}
                    errorMessage={`Please provide a valid ${column.title}`}
                    handleBlur={handleBlur}
                    handleChange={handleChange}
                    name={column.attributeName}
                    touched={touched[column.attributeName]}
                    type={column.attributeName}
                    value={values[column.attributeName]}
                  />
                </Table.Cell>
              )) ||
              (column.isEditable && column.isDropdown && (
                <Table.Cell key={`dropDownElem${key.toString()}`} verticalAlign={'top'} width={column.width}>
                  <Dropdown
                    compact
                    selection
                    options={column.dropdownOptions}
                    placeholder={activeRole}
                    value={activeRole}
                    onChange={(_, { value }): void => {
                      setActiveRole(value)
                      setFieldValue(column.attributeName, value)
                    }}
                  />
                </Table.Cell>
              )) || (
                <Table.Cell key={`tableValue${key.toString()}`} verticalAlign={'middle'} width={column.width}>
                  {values[column.attributeName]}
                </Table.Cell>
              )
          )}
          <Table.Cell textAlign="right">
            <div className="buttonCell">
              <Button
                className="mr-1 w-10 h-10"
                disabled={!isValid || (!dirty && (!initialValues.role || initialValues.role === activeRole))}
                onClick={(): void => {
                  handleModification(data.id, values, false)
                }}
              >
                <FontAwesomeIcon icon={faFloppyDisk} />
              </Button>
              <Button className="w-10 h-10" icon="undo" onClick={onDiscard}>
                <FontAwesomeIcon icon={faRotateLeft} />
              </Button>
            </div>
          </Table.Cell>

          <Confirm
            cancelButton={'Go Back'}
            confirmButton={'Modify User'}
            content={(): React.ReactElement => {
              return <ConfirmationContent columns={columns} initialValues={initialValues} values={values} />
            }}
            open={editConfirmation}
            onCancel={(): Promise<void> => handleModification(data.id, values, false)}
            onConfirm={(): void => {
              handleModification(data.id, values, true)
              onSuccessfulModification()
            }}
          />
          <style jsx>
            {`
              @import 'src/theme';

              :global(.ui.input > input) {
                width: 100%;
              }
              .buttonCell {
                display: flex;
                flex-direction: row;
              }
            `}
          </style>
        </>
      )}
      validationSchema={object().shape({
        ...validationSchema,
      })}
      onSubmit={(): Promise<void> => handleModification(data.id, undefined, false)}
    />
  )
}

export default EditTableRowForm
