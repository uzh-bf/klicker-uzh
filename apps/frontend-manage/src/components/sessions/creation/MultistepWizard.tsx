import { LearningElementOrderType } from '@klicker-uzh/graphql/dist/ops'
import { Button, Workflow } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import React, { useEffect, useState } from 'react'
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

function Validator({
  stepNumber,
  validateForm,
  errors,
}: {
  stepNumber: number
  validateForm: () => void
}) {
  useEffect(() => {
    validateForm()
  }, [stepNumber, validateForm])

  console.log(errors)

  return null
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
  const t = useTranslations()
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
        {({
          values,
          isSubmitting,
          isValid,
          resetForm,
          validateForm,
          errors,
        }) => (
          <Form className="border rounded-md h-76 border-uzh-grey-60">
            <Validator
              stepNumber={stepNumber}
              validateForm={validateForm}
              errors={errors}
            />
            <Workflow
              items={workflowItems}
              onClick={(_, ix) => setStepNumber(ix)}
              activeIx={stepNumber}
              // TODO: choose optimal disabled logic - allow to jump between 3 and 1 if all valid
              disabledFrom={isValid ? stepNumber + 2 : stepNumber + 1}
              minimal
              showTooltipSymbols
              className={{
                item: 'first:rounded-tl-md last:rounded-tr-md',
              }}
            />
            <div className="flex flex-col justify-between gap-1 p-4 md:h-60">
              {!isCompleted && <>{step}</>}
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
              {!isCompleted && (
                <Button
                  disabled={isSubmitting || !isValid}
                  type="submit"
                  data={{ cy: 'next-or-submit' }}
                  className={{ root: 'w-max self-end' }}
                >
                  {stepNumber === steps.length - 1
                    ? editMode
                      ? t('shared.generic.save')
                      : t('shared.generic.create')
                    : t('shared.generic.continue')}
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
