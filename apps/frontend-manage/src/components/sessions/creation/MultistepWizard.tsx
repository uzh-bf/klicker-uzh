import { Session } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import React, { useState } from 'react'

interface FormProps {
  children: React.ReactNode[]
  initialValues?: Partial<Session>
  onSubmit: (values: any, bag: any) => void
  stepNumber: number
  setStepNumber: (newValue: number) => void
  isInitialValid: boolean
}

export interface LiveSessionFormValues {
  name: string
  displayName: string
  description: string
  blocks: {
    questionIds: number[]
    titles: string[]
    timeLimit: number
  }[]
  courseId: string
  multiplier: string
  isGamificationEnabled: boolean
}

export interface MicroSessionFormValues {
  name: string
  displayName: string
  description: string
  questions: {
    id: number
    title: string
  }[]
  startDate: string
  endDate: string
  multiplier: string
  courseId: string
}

export interface LearningElementFormValues {
  name: string
  displayName: string
  description: string
  questions: any
  multiplier: string
  courseId: string
  order: any
  resetTimeDays: string
}

function MultistepWizard({
  children,
  initialValues,
  onSubmit,
  stepNumber,
  setStepNumber,
  isInitialValid,
}: FormProps) {
  const steps = React.Children.toArray(children)

  const [snapshot, setSnapshot] = useState(initialValues)

  const step = steps[stepNumber]
  const totalSteps = steps.length
  const isLastStep = stepNumber === totalSteps - 1

  const next = (
    values:
      | LiveSessionFormValues
      | MicroSessionFormValues
      | LearningElementFormValues
  ) => {
    setSnapshot(values)
    setStepNumber(Math.min(stepNumber + 1, totalSteps - 1))
  }

  const previous = (
    values:
      | LiveSessionFormValues
      | MicroSessionFormValues
      | LearningElementFormValues
  ) => {
    setSnapshot(values)
    setStepNumber(Math.max(stepNumber - 1, 0))
  }

  const handleSubmit = async (
    values:
      | LiveSessionFormValues
      | MicroSessionFormValues
      | LearningElementFormValues,
    bag: any
  ) => {
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
      isInitialValid={isInitialValid}
      onSubmit={handleSubmit}
      validationSchema={step.props.validationSchema}
    >
      {({ values, isSubmitting }) => (
        <Form>
          <p>
            Step {stepNumber + 1} of {totalSteps}
          </p>
          {step}
          <div className="flex">
            {stepNumber > 0 && (
              <Button onClick={() => previous(values)} type="button">
                Zurück
              </Button>
            )}
            <div>
              <Button disabled={isSubmitting} type="submit">
                {isLastStep ? 'Erstellen' : 'Weiter'}
              </Button>
            </div>
          </div>
        </Form>
      )}
    </Formik>
  )
}

export const WizardStep = ({ children }: any) => children

export default MultistepWizard
