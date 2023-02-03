import { Session } from '@klicker-uzh/graphql/dist/ops'
import { Form, Formik } from 'formik'
import React, { useState } from 'react'

interface LiveSessionCreationFormProps {
  children: React.ReactNode[]
  initialValues?: Partial<Session>
  onSubmit: (values: any, bag: any) => void
  stepNumber: number
  setStepNumber: (newValue: number) => void
}

function MultistepWizard({
  children,
  initialValues,
  onSubmit,
  stepNumber,
  setStepNumber,
}: LiveSessionCreationFormProps) {
  const steps = React.Children.toArray(children)
  const [snapshot, setSnapshot] = useState(initialValues)

  const step = steps[stepNumber]
  const totalSteps = steps.length
  const isLastStep = stepNumber === totalSteps - 1

  const next = (values: any) => {
    setSnapshot(values)
    setStepNumber(Math.min(stepNumber + 1, totalSteps - 1))
  }

  const previous = (values: any) => {
    setSnapshot(values)
    setStepNumber(Math.max(stepNumber - 1, 0))
  }

  const handleSubmit = async (values: any, bag: any) => {
    if (step.props.onSubmit) {
      await step.props.onSubmit(values, bag)
    }

    if (isLastStep) {
      return onSubmit(values, bag)
    }

    bag.setTouched({})
    next(values)
  }

  return (
    <Formik
      initialValues={snapshot}
      onSubmit={handleSubmit}
      validationSchema={step.props.validationSchema}
    >
      {({ values, isSubmitting }) => (
        <Form>
          <p>
            Step {stepNumber + 1} of {totalSteps}
          </p>
          {step}
          <div style={{ display: 'flex' }}>
            {stepNumber > 0 && (
              <button onClick={() => previous(values)} type="button">
                Back
              </button>
            )}
            <div>
              <button disabled={isSubmitting} type="submit">
                {isLastStep ? 'Submit' : 'Next'}
              </button>
            </div>
          </div>
        </Form>
      )}
    </Formik>
  )
}

export const WizardStep = ({ children }: any) => children

export default MultistepWizard
