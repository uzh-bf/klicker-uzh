import React from 'react'
import { FormattedMessage } from 'react-intl'
import { Formik } from 'formik'
import { object } from 'yup'
import {  Button, Confirm, Table } from 'semantic-ui-react'

import FormikInput from './components/FormikInput'
import validationSchema from './common/validationSchema'

function ConfirmationContent({ columns, initialValues , values } : {columns : any, initialValues : any, values : any}) : React.ReactElement {
    return (
      <p className="content">
        <h3>The following changes will be made: {'\n'}</h3>
        {columns.map((column) => (
            initialValues[column.attributeName] !== values[column.attributeName] ? <p>{'\n'}{column.title}: {initialValues[column.attributeName]} -&gt; {values[column.attributeName]}</p> : ''
        ))}
    <style jsx>
        {`
            @import 'src/theme';
            .content{ padding: 1rem;}
        `}
    </style>
    </p>
    )}

interface Props {
    data: any,
    columns: any [],
    editConfirmation: boolean,
    handleModification: (id : string, values : any, confirm : boolean) => Promise<void>
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
} : Props) : React.ReactElement {

    const initialValues = {}
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
            }) : React.ReactElement => (
                <>
                    {columns.map((column) : React.ReactElement => (
                        (column.isEditable && (
                        <Table.Cell verticalAlign={'top'} width={column.width}>
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
                        </Table.Cell> )) || (
                            <Table.Cell verticalAlign={'middle'} width={column.width}>
                                {values[column.attributeName]}
                            </Table.Cell>
                        ) 
                    ))}
                        <Table.Cell textAlign="right">
                            <div className="buttonCell">
                                <div className="saveButton">
                                    <Button
                                        primary
                                        className="save"
                                        disabled={ !isValid || !dirty}
                                        onClick={() : void => {
                                            handleModification(data.id, values, false)
                                        }}
                                    >
                                        <FormattedMessage defaultMessage="Save" id="form.button.save" />
                                    </Button>
                                </div>
                                <div className="saveButton">
                                    <Button 
                                        className="discard"  
                                        type="button"
                                        onClick={onDiscard} 
                                    ><FormattedMessage defaultMessage="Discard" id="form.button.discard" />
                                    </Button>
                                </div>
                            </div>
                        </Table.Cell>
                        
                        <Confirm 
                            cancelButton={'Go Back'}
                            confirmButton={'Modify User'}
                            content={() : React.ReactElement => {
                            return <ConfirmationContent columns={columns} initialValues={initialValues} values={values}/>}
                        }
                            open={editConfirmation}
                            onCancel={() : Promise<void> => handleModification(data.id, values, false)}
                            onConfirm={() : void  => {
                                handleModification(data.id, values, true)
                                onSuccessfulModification()
                            }}
                        />
                        <style jsx>
                            {`
                                @import 'src/theme';

                                :global(.ui.input > input ){
                                  width: 100%;
                                }
                                .buttonCell{
                                    display: flex; 
                                    flex-direction: row;   
                                    .saveButton {
                                        width: 50%;
                                    } 
                                }
                            `}
                        </style>
                    </>
            )
        }
        validationSchema={object()
            .shape({
                ...validationSchema
            })}
        onSubmit={() : Promise<void> => handleModification(data.id, undefined, false)}

       />
    )
}

export default EditTableRowForm



