import { FormikTextField, Label } from '@uzh-bf/design-system'
import { ErrorMessage, FieldArray, useField } from 'formik'
import { useState } from 'react'
import * as yup from 'yup'
import AddBlockButton from './AddBlockButton'
import EditorField from './EditorField'
import MultistepWizard, { WizardStep } from './MultistepWizard'
import SessionCreationBlock from './SessionCreationBlock'

function LiveSessionWizzard() {
  const [stepNumber, setStepNumber] = useState(0)

  return (
    <div>
      <h1>Formik Multistep Wizard</h1>
      <MultistepWizard
        initialValues={{
          name: '',
          displayName: '',
          description: '',
          blocks: [{ questionIds: [], titles: [], timeLimit: undefined }],
          courseId: '',
          multiplier: '1',
          isGamificationEnabled: false,
        }}
        stepNumber={stepNumber}
        setStepNumber={setStepNumber}
        onSubmit={(values) => () => console.log('Wizard submit', values)}
      >
        <StepOne />
        <div>TEST</div>
        {/* <WizardStep
            key={1}
            onSubmit={() => console.log('Step2 onSubmit')}
            validationSchema={yup.object().shape({
              email: yup.string().required('Email is required'),
            })}
          >
            <div>
              <label htmlFor="email">Email</label>
              <FormikTextField
                autoComplete="email"
                component="input"
                id="email"
                name="email"
                placeholder="Email"
                type="text"
              />
              <ErrorMessage className="error" component="div" name="email" />
            </div>
          </WizardStep> */}
      </MultistepWizard>
    </div>
  )
}

export default LiveSessionWizzard

function StepOne() {
  const [fieldName, metaName, helpersName] = useField('name')
  const [fieldDescription, metaDescription, helpersDescription] =
    useField('description')

  return (
    <WizardStep
      onSubmit={() => console.log('Step1 onSubmit')}
      validationSchema={yup.object().shape({
        name: yup
          .string()
          .required('Bitte geben Sie einen Namen für Ihre Session ein.'),
        displayName: yup
          .string()
          .required('Bitte geben Sie einen Anzeigenamen für Ihre Session ein.'),
        description: yup.string(),
      })}
    >
      <FormikTextField
        required
        name="name"
        label="Session-Name"
        tooltip="Dieser Name der Session soll Ihnen ermöglichen diese Session von anderen zu unterscheiden. Er wird den Teilnehmenden nicht angezeigt, verwenden Sie hierfür bitte den Anzeigenamen im nächsten Feld."
        className={{ root: 'mb-1' }}
        data-cy="insert-live-session-name"
        shouldValidate={() => true}
      />

      <FormikTextField
        required
        name="displayName"
        label="Anzeigenamen"
        tooltip="Dieser Session-Name wird den Teilnehmenden bei der Durchführung angezeigt."
        className={{ root: 'mb-1' }}
        data-cy="insert-live-display-name"
      />

      <EditorField
        key={fieldName.value}
        label="Beschreibung"
        tooltip="// TODO CONTENT TOOLTIP"
        field={fieldDescription.value}
        fieldName="description"
        setFieldValue={(name, value, shouldValidate) => {
          helpersDescription.setValue(value, shouldValidate)
        }}
        error={metaDescription.error}
        touched={metaDescription.touched}
      />

      <div className="w-full text-right">
        <ErrorMessage
          name="description"
          component="div"
          className="text-sm text-red-400"
        />
      </div>
    </WizardStep>
  )
}

function StepTwo() {
  const [fieldName, metaName, helpersName] = useField('blocks')
  const [fieldDescription, metaDescription, helpersDescription] =
    useField('description')

  return (
    <WizardStep
      onSubmit={() => console.log('Step1 onSubmit')}
      validationSchema={yup.object().shape({
        name: yup
          .string()
          .required('Bitte geben Sie einen Namen für Ihre Session ein.'),
        displayName: yup
          .string()
          .required('Bitte geben Sie einen Anzeigenamen für Ihre Session ein.'),
        description: yup.string(),
      })}
    >
      <div className="mt-2 mb-2">
        <div className="flex flex-row items-center flex-1 gap-2">
          <Label
            label="Frageblöcke:"
            className={{
              root: 'font-bold',
              tooltip: 'font-normal text-sm !w-1/2',
            }}
            tooltip="Fügen Sie mittels Drag&Drop auf das Plus-Icon Fragen zu Ihren Blöcken hinzu. Neue Blöcken können entweder ebenfalls durch Drag&Drop auf das entsprechende Feld oder durch Klicken auf den Button erstellt werden."
            showTooltipSymbol={true}
          />
          <FieldArray name="blocks">
            {({ push, remove, move }: FieldArrayRenderProps) => (
              <div className="flex flex-row gap-1 overflow-scroll">
                {values.blocks.map((block: any, index: number) => (
                  <SessionCreationBlock
                    key={`${index}-${block.questionIds.join('')}`}
                    index={index}
                    block={block}
                    numOfBlocks={values.blocks.length}
                    setFieldValue={setFieldValue}
                    remove={remove}
                    move={move}
                  />
                ))}
                <AddBlockButton push={push} />
              </div>
            )}
          </FieldArray>
        </div>
        <ErrorMessage
          name="blocks"
          component="div"
          className="text-sm text-red-400"
        />
      </div>
    </WizardStep>
  )
}
