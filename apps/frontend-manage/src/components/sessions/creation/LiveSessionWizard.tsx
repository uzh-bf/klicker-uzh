import { FormikTextField, Label } from '@uzh-bf/design-system'
import { ErrorMessage } from 'formik'
import { useState } from 'react'
import * as yup from 'yup'
import MultistepWizard from './MultistepWizard'

function LiveSessionWizard() {
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
        onSubmit={(values) => console.log('Wizard submit', values)}
      >
        <StepOne
          onSubmit={() => console.log('Step1 onSubmit')}
          validationSchema={yup.object().shape({
            name: yup
              .string()
              .required('Bitte geben Sie einen Namen für Ihre Session ein.'),
            displayName: yup
              .string()
              .required(
                'Bitte geben Sie einen Anzeigenamen für Ihre Session ein.'
              ),
            description: yup.string(),
          })}
        />
        <StepTwo
          onSubmit={() => console.log('Step2 onSubmit')}
          validationSchema={yup.object().shape({
            blabla: yup
              .string()
              .required('Bitte geben Sie einen Namen für Ihre Session ein.'),
          })}
        />
      </MultistepWizard>
    </div>
  )
}

export default LiveSessionWizard

interface StepProps {
  onSubmit: () => void
  validationSchema: any
}

function StepOne(_: StepProps) {
  return (
    <>
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

      {/* <EditorField
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
          /> */}

      <div className="w-full text-right">
        <ErrorMessage
          name="description"
          component="div"
          className="text-sm text-red-400"
        />
      </div>
    </>
  )
}

function StepTwo(_: StepProps) {
  return (
    <>
      <div className="mt-2 mb-2">
        <div className="flex flex-row items-center flex-1 gap-2">
          <FormikTextField
            required
            name="blabla"
            label="Anzeigenamen"
            tooltip="Dieser Session-Name wird den Teilnehmenden bei der Durchführung angezeigt."
            className={{ root: 'mb-1' }}
            data-cy="insert-live-display-name"
          />
          <Label
            label="Frageblöcke:"
            className={{
              root: 'font-bold',
              tooltip: 'font-normal text-sm !w-1/2',
            }}
            tooltip="Fügen Sie mittels Drag&Drop auf das Plus-Icon Fragen zu Ihren Blöcken hinzu. Neue Blöcken können entweder ebenfalls durch Drag&Drop auf das entsprechende Feld oder durch Klicken auf den Button erstellt werden."
            showTooltipSymbol={true}
          />
          {/* <FieldArray name="blocks">
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
        </FieldArray> */}
        </div>
        <ErrorMessage
          name="blocks"
          component="div"
          className="text-sm text-red-400"
        />
      </div>
    </>
  )
}
