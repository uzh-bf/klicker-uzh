import { MicroSession } from '@klicker-uzh/graphql/dist/ops'
import {
  FormikSelectField,
  FormikTextField,
  Label,
} from '@uzh-bf/design-system'
import { ErrorMessage } from 'formik'
import { useState } from 'react'
import * as yup from 'yup'
import BlockField from './BlockField'
import EditorField from './EditorField'
import MultistepWizard from './MultistepWizard'

interface MicroSessionWizardProps {
  courses?: {
    label: string
    value: string
  }[]
  initialValues?: Partial<MicroSession>
}

const stepOneValidationSchema = yup.object().shape({
  name: yup
    .string()
    .required('Bitte geben Sie einen Namen für Ihre Session ein.'),
  displayName: yup
    .string()
    .required('Bitte geben Sie einen Anzeigenamen für Ihre Session ein.'),
  description: yup.string(),
})

const stepTwoValidationSchema = yup.object().shape({
  questions: yup
    .array()
    .of(
      yup.object().shape({
        id: yup.string(),
        title: yup.string(),
      })
    )
    .min(1),
})

function MicroSessionWizard({
  courses,
  initialValues,
}: MicroSessionWizardProps) {
  const [stepNumber, setStepNumber] = useState(0)

  return (
    <div>
      <Label label="Micro-Session erstellen" />
      <MultistepWizard
        initialValues={{
          name: initialValues?.name || '',
          displayName: initialValues?.displayName || '',
          description: initialValues?.description || '',
          questions:
            initialValues?.instances?.map((instance) => {
              return {
                id: instance.questionData.id,
                title: instance.questionData.name,
              }
            }) || [],
          startDate: initialValues?.scheduledStartAt || '',
          endDate: initialValues?.scheduledEndAt || '',
          multiplier: initialValues?.pointsMultiplier
            ? String(initialValues?.pointsMultiplier)
            : '1',
          courseId: initialValues?.course?.id || courses[0].value,
        }}
        isInitialValid={initialValues ? true : false}
        stepNumber={stepNumber}
        setStepNumber={setStepNumber}
        onSubmit={(values) => console.log('Wizard submit', values)}
      >
        <StepOne
          onSubmit={() => console.log('Step 1 onSubmit')}
          validationSchema={stepOneValidationSchema}
        />
        <StepTwo
          onSubmit={() => console.log('Step 2 onSubmit')}
          validationSchema={stepTwoValidationSchema}
        />
      </MultistepWizard>
    </div>
  )
}

export default MicroSessionWizard

interface StepProps {
  onSubmit?: () => void
  validationSchema: any
  courses?: {
    label: string
    value: string
  }[]
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
      />
      <FormikTextField
        required
        name="displayName"
        label="Anzeigenamen"
        tooltip="Dieser Session-Name wird den Teilnehmenden bei der Durchführung angezeigt."
        className={{ root: 'mb-1' }}
      />

      <EditorField
        label="Beschreibung"
        tooltip="Fügen Sie eine Beschreibung zu Ihrer Micro-Session hinzu, welche den Teilnehmern zu Beginn angezeigt wird."
        fieldName="description"
      />

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
        <BlockField fieldName="questions" />
        <ErrorMessage
          name="questions"
          component="div"
          className="text-sm text-red-400"
        />
      </div>
    </>
  )
}

function StepThree(props: StepProps) {
  return (
    <>
      <div className="flex flex-row items-center">
        <Label
          label="Optionen"
          className={{
            root: 'my-auto mr-2 font-bold min-w-max',
            tooltip: 'text-sm font-normal !w-1/2',
          }}
        />

        <FormikSelectField
          name="courseId"
          items={props.courses || []}
          required
          tooltip="Für die Erstellung einer Micro-Session ist die Auswahl des zugehörigen Kurses erforderlich."
          label="Kurs"
          className={{ label: 'font-normal' }}
        />

        {/* <Label label="Startdatum" required className={{ root: 'ml-4' }} />
        <input
          key={'startDate'}
          type="datetime-local"
          value={(dayjs(values.startDate).local().format() || '')
            .toString()
            .substring(0, 16)}
          onChange={(e) => {
            if (e.target['validity'].valid) {
              setFieldValue(
                'startDate',
                dayjs(e.target['value']).utc().format()
              )
            }
          }}
        />

        <Label label="Enddatum" required className={{ root: 'ml-4' }} />
        <input
          key={'endDate'}
          type="datetime-local"
          value={(dayjs(values.endDate).local().format() || '')
            .toString()
            .substring(0, 16)}
          onChange={(e) => {
            if (e.target['validity'].valid) {
              setFieldValue('endDate', dayjs(e.target['value']).utc().format())
            }
          }}
        /> */}

        <Label label="Multiplier:" className={{ root: 'ml-4 mr-2' }} />
        <FormikSelectField
          name="multiplier"
          placeholder="Default: 1x"
          items={[
            { label: 'Einfach (1x)', value: '1' },
            { label: 'Doppelt (2x)', value: '2' },
            { label: 'Dreifach (3x)', value: '3' },
            { label: 'Vierfach (4x)', value: '4' },
          ]}
        />
      </div>
    </>
  )
}
