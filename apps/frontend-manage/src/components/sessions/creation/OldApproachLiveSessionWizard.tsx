import { Session } from '@klicker-uzh/graphql/dist/ops'
import { Button, FormikTextField } from '@uzh-bf/design-system'
import { ErrorMessage, Field, Form, Formik } from 'formik'
import { useState } from 'react'
import * as yup from 'yup'
import EditorField from './EditorField'

// const initialLiveSessionValues = {
//   name: '',
//   displayName: '',
//   description: '',
//   blocks: [{ questionIds: [], titles: [], timeLimit: undefined }],
//   courseId: '',
//   multiplier: '1',
//   isGamificationEnabled: false,
// }

interface LiveSessionCreationFormProps {
  courses?: {
    label: string
    value: string
  }[]
  initialValues?: Partial<Session>
}
function OldApproachLiveSessionWizard({
  courses,
  initialValues,
}: LiveSessionCreationFormProps) {
  const [liveSessionData, setLiveSessionData] = useState({
    name: initialValues?.name || '',
    displayName: initialValues?.displayName || '',
    description: initialValues?.description || '',
    blocks: initialValues?.blocks?.map((block) => {
      return {
        questionIds: block.instances.map(
          (instance) => instance.questionData.id
        ),
        titles: block.instances.map((instance) => instance.questionData.name),
        timeLimit: block.timeLimit ?? undefined,
      }
    }) || [{ questionIds: [], titles: [], timeLimit: undefined }],
    courseId: initialValues?.course?.id || '',
    multiplier: initialValues?.pointsMultiplier
      ? String(initialValues?.pointsMultiplier)
      : '1',
    isGamificationEnabled: initialValues?.isGamificationEnabled || false,
  })

  const [currentStep, setCurrentStep] = useState(0)

  const makeRequest = (formData) => {
    console.log('Form Submitted', formData)
  }

  const handleNextStep = (newData, final = false) => {
    console.log('handleNextStep')
    setLiveSessionData((prev) => ({ ...prev, ...newData }))

    if (final) {
      makeRequest(newData)
      return
    }

    setCurrentStep((prev) => prev + 1)
  }

  const handlePrevStep = (newData) => {
    setLiveSessionData((prev) => ({ ...prev, ...newData }))
    setCurrentStep((prev) => prev - 1)
  }

  const steps = [
    <StepOne key={1} next={handleNextStep} data={liveSessionData} />,
    <StepTwo
      key={2}
      prev={handlePrevStep}
      next={handleNextStep}
      data={liveSessionData}
    />,
  ]

  return <div>{steps[currentStep]}</div>
}

export default OldApproachLiveSessionWizard

const stepOneValidationSchema = yup.object({
  first_name: yup.string().required(),
  last_name: yup.string().required(),
})

const StepOne = (props: any) => {
  const handleSubmit = (values: any) => {
    console.log('StepOne: handleSubmit')
    props.next(values)
  }

  return (
    <Formik
      initialValues={props.data}
      onSubmit={handleSubmit}
      validationSchema={stepOneValidationSchema}
    >
      {({ values, errors, touched, setFieldValue, isSubmitting, isValid }) => {
        return (
          <Form>
            <FormikTextField
              required
              name="name"
              label="Session-Name"
              tooltip="Dieser Name der Session soll Ihnen ermöglichen diese Session von anderen zu unterscheiden. Er wird den Teilnehmenden nicht angezeigt, verwenden Sie hierfür bitte den Anzeigenamen im nächsten Feld."
              className={{ root: 'mb-1' }}
              data-cy="insert-live-session-name"
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
              key={values?.name}
              label="Beschreibung"
              tooltip="// TODO CONTENT TOOLTIP"
              field={values?.description}
              fieldName="description"
              setFieldValue={setFieldValue}
              error={errors.description}
              touched={touched.description}
            />
            <div className="w-full text-right">
              <ErrorMessage
                name="description"
                component="div"
                className="text-sm text-red-400"
              />
            </div>
            <Button type="submit">Next</Button>
          </Form>
        )
      }}
    </Formik>
  )
}

const stepTwoValidationSchema = yup.object({
  email: yup.string().required(),
  password: yup.string().required(),
})

const StepTwo = (props: any) => {
  const handleSubmit = (values: any) => {
    props.next(values, true)
  }

  return (
    <Formik
      initialValues={props.data}
      onSubmit={handleSubmit}
      validationSchema={stepTwoValidationSchema}
    >
      {({ values }) => (
        <Form>
          <p>Email</p>
          <Field name="email" />
          <ErrorMessage name="email" />

          <p>Password</p>
          <Field name="password" />
          <ErrorMessage name="password" />

          <button type="button" onClick={() => props.prev(values)}>
            Back
          </button>
          <button type="submit">Submit</button>
        </Form>
      )}
    </Formik>
  )
}
