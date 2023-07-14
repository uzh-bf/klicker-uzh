import { LearningElementOrderType } from '@klicker-uzh/graphql/dist/ops'
import { Button, Workflow } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import React, { useState } from 'react'
import CompletionStep from './CompletionStep'

interface MultistepWizardProps {
  isCompleted: boolean
  editMode: boolean
  completionSuccessMessage?: (elementName: string) => React.ReactNode
  children: React.ReactNode[]
  initialValues?: any
  onSubmit: (values: any, bag: any) => void
  onViewElement: () => void
  onRestartForm: () => void
  workflowItems: {
    title: string
    tooltip?: string
    tooltipDisabled?: string
  }[]
}

interface CommonFormValues {
  name: string
  displayName: string
  description: string
  courseId: string
  multiplier: string
}

export interface LiveSessionFormValues extends CommonFormValues {
  blocks: {
    questionIds: number[]
    titles: string[]
    timeLimit: number
  }[]
  isGamificationEnabled: boolean
}

export interface MicroSessionFormValues extends CommonFormValues {
  questions: {
    id: number
    title: string
    hasAnswerFeedbacks: boolean
    hasSampleSolution: boolean
  }[]
  startDate: string
  endDate: string
  order: LearningElementOrderType
  resetTimeDays: string
}

export interface LearningElementFormValues extends CommonFormValues {
  questions: {
    id: number
    title: string
    hasAnswerFeedbacks: boolean
    hasSampleSolution: boolean
  }[]
  order: any
  resetTimeDays: string
}

function MultistepWizard({
  children,
  initialValues,
  onSubmit,
  isCompleted,
  editMode,
  completionSuccessMessage,
  onViewElement,
  onRestartForm,
  workflowItems,
}: MultistepWizardProps) {
  const [stepNumber, setStepNumber] = useState(0)
  const steps = React.Children.toArray(children)
  const step = steps[stepNumber] as React.ReactElement

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

    if (stepNumber === steps.length - 1) {
      return onSubmit(values, bag)
    } else {
      bag.setTouched({})
      setStepNumber(Math.min(stepNumber + 1, steps.length - 1))
    }
  }

  return (
    <>
      <Formik
        initialValues={initialValues}
        onSubmit={handleSubmit}
        validationSchema={step.props.validationSchema}
        isInitialValid={editMode}
        enableReinitialize
      >
        {({ values, isSubmitting, isValid, resetForm }) => (
          <Form className="border rounded-md h-76 border-uzh-grey-60">
            <Workflow
              items={workflowItems}
              onClick={(_, ix) => setStepNumber(ix)}
              activeIx={stepNumber}
              // TODO: choose optimal disabled logic - allow to jump between 3 and 1 if all valid
              disabledFrom={isValid ? stepNumber + 2 : stepNumber + 1}
              minimal
              className={{
                item: 'first:rounded-tl-md last:rounded-tr-md',
              }}
            />
            <div className="flex flex-col justify-between gap-1 p-4 overflow-y-auto h-60">
              {!isCompleted && <div>{step}</div>}
              {isCompleted && (
                <CompletionStep
                  completionSuccessMessage={completionSuccessMessage}
                  name={values.name}
                  editMode={editMode}
                  onViewElement={onViewElement}
                  onRestartForm={onRestartForm}
                  resetForm={resetForm}
                  setStepNumber={setStepNumber}
                />
              )}
              {isValid && !isCompleted && (
                <Button
                  disabled={isSubmitting && !isValid}
                  type="submit"
                  data={{ cy: 'next-or-submit' }}
                  className={{ root: 'w-max self-end' }}
                >
                  {stepNumber === steps.length - 1
                    ? editMode
                      ? 'Speichern'
                      : 'Erstellen'
                    : 'Weiter'}
                </Button>
              )}
            </div>
          </Form>
        )}
      </Formik>
    </>
  )
}

export const WizardStep = ({ children }: any) => children

export default MultistepWizard
