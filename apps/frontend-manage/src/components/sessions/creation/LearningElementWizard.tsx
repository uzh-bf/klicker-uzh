import { useMutation } from '@apollo/client'
import SessionCreationErrorToast from '@components/toasts/SessionCreationErrorToast'
import {
  CreateLearningElementDocument,
  LearningElementOrderType,
} from '@klicker-uzh/graphql/dist/ops'
import {
  FormikNumberField,
  FormikSelectField,
  FormikTextField,
  H3,
} from '@uzh-bf/design-system'
import { ErrorMessage } from 'formik'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { LEARNING_ELEMENT_ORDERS } from 'shared-components/src/constants'
import * as yup from 'yup'
import BlockField from './BlockField'
import EditorField from './EditorField'
import MultistepWizard, { MicroSessionFormValues } from './MultistepWizard'

interface LearningElementWizardProps {
  courses: {
    label: string
    value: string
  }[]
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

//TODO: adjust validation
const stepTwoValidationSchema = yup.object().shape({
  multiplier: yup
    .string()
    .matches(/^[0-9]+$/, 'Bitte geben Sie einen gültigen Multiplikator ein.'),
  courseId: yup.string(),
  order: yup.string(),
  resetTimeDays: yup
    .string()
    .required(
      'Bitte geben Sie eine Anzahl Tage ein nach welcher das Lernelement wiederholt werden kann.'
    )
    .matches(
      /^[0-9]+$/,
      'Bitte geben Sie eine gültige Anzahl Tage ein nach welcher das Lernelement wiederholt werden kann.'
    ),
})

const stepThreeValidationSchema = yup.object().shape({
  questions: yup
    .array()
    .of(
      yup.object().shape({
        id: yup.string(),
        title: yup.string(),
        // hasAnswerFeedbacks: yup.boolean().when('type', {
        //   is: (type) => ['SC', 'MC', 'KPRIM'].includes(type),
        //   then: yup.boolean().isTrue(),
        // }),
        // hasAnswerFeedbacks: yup.boolean().isTrue(),
        hasSampleSolution: yup
          .boolean()
          .isTrue('Bitte fügen Sie nur Fragen mit Lösung hinzu.'),
      })
    )
    .min(1),
})

function LearningElementWizard({ courses }: LearningElementWizardProps) {
  const router = useRouter()

  const [createLearningElement] = useMutation(CreateLearningElementDocument)
  const [errorToastOpen, setErrorToastOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [isWizardCompleted, setIsWizardCompleted] = useState(false)

  const initialValues = {
    name: '',
    displayName: '',
    description: '',
    questions: [],
    multiplier: '1',
    courseId: courses[0].value,
    order: Object.keys(LEARNING_ELEMENT_ORDERS)[0],
    resetTimeDays: '6',
  }

  const onSubmit = async (values: MicroSessionFormValues) => {
    try {
      const result = await createLearningElement({
        variables: {
          name: values.name,
          displayName: values.displayName,
          description: values.description,
          questions: values.questions.map((q: any) => q.id),
          multiplier: parseInt(values.multiplier),
          courseId: values.courseId,
          order: values.order as LearningElementOrderType,
          resetTimeDays: parseInt(values.resetTimeDays),
        },
      })

      if (result.data?.createLearningElement) {
        setIsWizardCompleted(true)
      }
      setSelectedCourseId(values.courseId)
    } catch (error) {
      console.log(error)
      // TODO: set edit mode value correctly once editing is implemented
      setEditMode(false)
      setErrorToastOpen(true)
    }
  }

  return (
    <div>
      <MultistepWizard
        completionSuccessMessage={(elementName) => (
          <div>
            Lernelement <strong>{elementName}</strong> erfolgreich{' '}
            {editMode ? 'modifiziert' : 'erstellt'}.
          </div>
        )}
        initialValues={initialValues}
        onSubmit={onSubmit}
        isCompleted={isWizardCompleted}
        onRestartForm={() => {
          setIsWizardCompleted(false)
        }}
        onViewElement={() => {
          router.push(`/courses/${selectedCourseId}`)
        }}
      >
        <StepOne validationSchema={stepOneValidationSchema} />
        <StepTwo validationSchema={stepTwoValidationSchema} courses={courses} />
        <StepThree validationSchema={stepThreeValidationSchema} />
      </MultistepWizard>
      <SessionCreationErrorToast
        open={errorToastOpen}
        setOpen={setErrorToastOpen}
        error={
          editMode
            ? 'Anpassen des Lernelements fehlgeschlagen...'
            : 'Erstellen des Lernelements fehlgeschlagen...'
        }
      />
    </div>
  )
}

export default LearningElementWizard

interface StepProps {
  onSubmit?: () => void
  validationSchema: any
  isInitialValid?: boolean
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
        autoComplete="off"
        name="name"
        label="Session-Name"
        tooltip="Dieser Name der Session soll Ihnen ermöglichen diese Session von anderen zu unterscheiden. Er wird den Teilnehmenden nicht angezeigt, verwenden Sie hierfür bitte den Anzeigenamen im nächsten Feld."
        className={{ root: 'mb-1' }}
      />
      <FormikTextField
        required
        autoComplete="off"
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

function StepTwo(props: StepProps) {
  return (
    <div className="flex flex-col gap-2">
      <H3 className={{ root: 'mb-0' }}>Einstellungen</H3>
      <div className="flex flex-row items-center gap-4">
        <FormikSelectField
          name="courseId"
          items={props.courses || [{ label: '', value: '' }]}
          required
          tooltip="Für die Erstellung einer Micro-Session ist die Auswahl des zugehörigen Kurses erforderlich."
          label="Kurs"
        />
        <ErrorMessage
          name="courseId"
          component="div"
          className="text-sm text-red-400"
        />
      </div>

      <div className="flex flex-row items-center gap-4">
        <FormikSelectField
          label="Multiplier"
          required
          tooltip="Wählen Sie einen Multiplier aus. Alle Punkte die von den Studierenden in dieser Session erreicht werden, werden mit dem Multiplier multipliziert."
          name="multiplier"
          placeholder="Default: 1x"
          items={[
            { label: 'Einfach (1x)', value: '1' },
            { label: 'Doppelt (2x)', value: '2' },
            { label: 'Dreifach (3x)', value: '3' },
            { label: 'Vierfach (4x)', value: '4' },
          ]}
        />
        <ErrorMessage
          name="multiplier"
          component="div"
          className="text-sm text-red-400"
        />
      </div>

      <div className="flex flex-row items-center gap-4">
        <FormikNumberField
          name="resetTimeDays"
          label="Wiederholungszeitraum:"
          tooltip="Wählen Sie einen Zeitraum nach welchem die Studierenden die Micro-Session wiederholen können."
          className={{
            input: 'w-20',
          }}
          required
          hideError={true}
        />
        <ErrorMessage
          name="resetTimeDays"
          component="div"
          className="text-sm text-red-400"
        />
      </div>

      <div className="flex flex-row items-center gap-4">
        <FormikSelectField
          label="Reihenfolge"
          tooltip="Wählen Sie eine Reihenfolge in welcher die Fragen für die Studierenden zu lösen sind."
          name="order"
          placeholder="Reihenfolge wählen"
          items={Object.keys(LEARNING_ELEMENT_ORDERS).map((key) => {
            return { value: key, label: LEARNING_ELEMENT_ORDERS[key] }
          })}
          required
        />
        <ErrorMessage
          name="order"
          component="div"
          className="text-sm text-red-400"
        />
      </div>
    </div>
  )
}

function StepThree(_: StepProps) {
  return (
    <>
      <div className="mt-2 mb-2">
        <BlockField fieldName="questions" />
      </div>
    </>
  )
}
