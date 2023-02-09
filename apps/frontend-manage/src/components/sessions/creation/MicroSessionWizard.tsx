import { useMutation } from '@apollo/client'
import MicroSessionCreationToast from '@components/toasts/MicroSessionCreationToast'
import SessionCreationErrorToast from '@components/toasts/SessionCreationErrorToast'
import {
  CreateMicroSessionDocument,
  EditMicroSessionDocument,
  MicroSession,
} from '@klicker-uzh/graphql/dist/ops'
import {
  FormikDateField,
  FormikSelectField,
  FormikTextField,
  Label,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { ErrorMessage } from 'formik'
import { useRouter } from 'next/router'
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
  startDate: yup
    .date()
    .required('Bitte geben Sie ein Startdatum für Ihre Session ein.'),
  endDate: yup
    .date()
    .min(yup.ref('startDate'), 'Das Enddatum muss nach dem Startdatum liegen.')
    .required('Bitte geben Sie ein Enddatum für Ihre Session ein.'),
  multiplier: yup
    .string()
    .matches(/^[0-9]+$/, 'Bitte geben Sie einen gültigen Multiplikator ein.'),
  courseId: yup.string(),
})

const stepThreeValidationSchema = yup.object().shape({
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

  const [successToastOpen, setSuccessToastOpen] = useState(false)
  const [errorToastOpen, setErrorToastOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const router = useRouter()

  const [createMicroSession] = useMutation(CreateMicroSessionDocument)
  const [editMicroSession] = useMutation(EditMicroSessionDocument)
  dayjs.extend(utc)

  const [selectedCourseId, setSelectedCourseId] = useState('')

  const onSubmit = async (values, { resetForm }) => {
    try {
      let success = false

      if (initialValues) {
        const result = await editMicroSession({
          variables: {
            id: initialValues?.id || '',
            name: values.name,
            displayName: values.displayName,
            description: values.description,
            questions: values.questions.map((q: any) => q.id),
            startDate: dayjs(values.startDate).utc().format(),
            endDate: dayjs(values.endDate).utc().format(),
            multiplier: parseInt(values.multiplier),
            courseId: values.courseId,
          },
        })
        success = Boolean(result.data?.editMicroSession)
      } else {
        const result = await createMicroSession({
          variables: {
            name: values.name,
            displayName: values.displayName,
            description: values.description,
            questions: values.questions.map((q: any) => q.id),
            startDate: dayjs(values.startDate).utc().format(),
            endDate: dayjs(values.endDate).utc().format(),
            multiplier: parseInt(values.multiplier),
            courseId: values.courseId,
          },
        })
        success = Boolean(result.data?.createMicroSession)
      }

      if (success) {
        setSelectedCourseId(values.courseId)
        router.push('/')
        setEditMode(!!initialValues)
        setSuccessToastOpen(true)
        resetForm()
      }
    } catch (error) {
      console.log(error)
      setEditMode(!!initialValues)
      setErrorToastOpen(true)
    }
  }

  return (
    <div>
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
                hasAnswerFeedbacks: instance.questionData.hasAnswerFeedbacks,
                hasSampleSolution: instance.questionData.hasSampleSolution,
              }
            }) || [],
          startDate: initialValues?.scheduledStartAt || '',
          endDate: initialValues?.scheduledEndAt || '',
          multiplier: initialValues?.pointsMultiplier
            ? String(initialValues?.pointsMultiplier)
            : '1',
          courseId: initialValues?.course?.id || courses[0].value,
        }}
        onSubmit={onSubmit}
      >
        <StepOne validationSchema={stepOneValidationSchema} />
        <StepTwo validationSchema={stepTwoValidationSchema} courses={courses} />
        <StepThree validationSchema={stepThreeValidationSchema} />
      </MultistepWizard>
      <MicroSessionCreationToast
        editMode={editMode}
        open={successToastOpen}
        setOpen={setSuccessToastOpen}
        courseId={selectedCourseId}
      />
      <SessionCreationErrorToast
        open={errorToastOpen}
        setOpen={setErrorToastOpen}
        error={
          editMode
            ? 'Anpassen der Micro-Session fehlgeschlagen...'
            : 'Erstellen der Micro-Session fehlgeschlagen...'
        }
      />
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

function StepTwo(props: StepProps) {
  return (
    <>
      <div className="flex flex-row items-center gap-4">
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

        <FormikDateField
          label="Startdatum"
          name="startDate"
          required
          className={{
            root: 'ml-4',
            input: 'bg-bg-uzh-grey-20',
            label: 'font-normal',
          }}
        />

        <FormikDateField
          label="Enddatum"
          name="endDate"
          required
          className={{
            root: 'ml-4',
            input: 'bg-bg-uzh-grey-20',
            label: 'font-normal',
          }}
        />

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

        <div>
          <ErrorMessage
            name="courseId"
            component="div"
            className="text-sm text-red-400"
          />

          <ErrorMessage
            name="multiplier"
            component="div"
            className="text-sm text-red-400"
          />
        </div>
      </div>
    </>
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
