import React from 'react'
import getConfig from 'next/config'
import { FormattedMessage, useIntl } from 'react-intl'
import { Formik } from 'formik'
import { object } from 'yup'
import { Form, Button, Confirm, Table } from 'semantic-ui-react'

import FormikInput from './components/FormikInput'
import validationSchema from './common/validationSchema'
import messages from './common/messages'

const { publicRuntimeConfig } = getConfig()

function EditTableRowForm({
    data,
    columns,
    editConfirmation,
    handleModification,
    onDiscard,
    ...args
}) : React.ReactElement {

    let initialValues = new Object()
    columns.map((column) => {
        initialValues[column.attributeName] = data[column.attributeName]
    })

    return (
       <Formik
            initialValues={initialValues}
            onSubmit={() => {}}
            render={({
                values,
                errors,
                touched,
                handleChange,
                handleBlur,
                handleSubmit,
                isValid,
                dirty,
            }) : React.ReactElement => (
                <>
                    {columns.map((column) : React.ReactElement => (
                        <Table.Cell>
                            <FormikInput 
                                required
                                error={errors[columns[0].attributeName]}
                                errorMessage={'hello'}
                                handleBlur={handleBlur}
                                handleChange={handleChange}
                                name={column.attributeName}
                                touched={true}
                                type={column.attributeName}
                                value={values[column.attributeName]}
                            />
                        </Table.Cell>
                    ))}
                        <Table.Cell>
                            <Button
                                primary
                                className="save"
                                disabled={ !isValid || !dirty}
                                type="submit"
                            >
                                <FormattedMessage defaultMessage="Save" id="form.button.save" />
                            </Button>
                            <Button 
                                className="discard"  
                                type="button"
                                onClick={onDiscard} 
                            ><FormattedMessage defaultMessage="Discard" id="form.button.discard" /></Button>
                        </Table.Cell>
                        <style jsx>
                            {`
                                @import 'src/theme';

                                :global(.ui .button){
                                    width: 100%;
                                }
                            `}
                            </style>
                    </>
            )}

       />
    )
}

export default EditTableRowForm



