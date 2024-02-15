import {
  faArrowRight,
  faCancel,
  faSave,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ElementOrderType } from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, Workflow } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import React, { useEffect, useState } from 'react'
import CompletionStep from './CompletionStep'

interface MultistepWizardProps {
  customCompletionAction?: React.ReactNode
  title: string
  isCompleted: boolean
  editMode: boolean
  initialValid: boolean
  completionSuccessMessage?: (elementName: string) => React.ReactNode
  children: React.ReactNode[]
  initialValues?: any
  onSubmit: (values: any, bag: any) => void
  onViewElement: () => void
  onRestartForm: () => void
  onCloseWizard: () => void
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
    types: []
    timeLimit: number
  }[]
  isGamificationEnabled: boolean
  isConfusionFeedbackEnabled: boolean
  isLiveQAEnabled: boolean
  isModerationEnabled: boolean
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
  order: ElementOrderType
  resetTimeDays: string
}

export interface PracticeQuizFormValues extends CommonFormValues {
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
}: {
  stepNumber: number
  validateForm: () => void
}) {
  useEffect(() => {
    validateForm()
  }, [stepNumber, validateForm])

  return null
}

function MultistepWizard({
  customCompletionAction,
  title,
  children,
  initialValues,
  onSubmit,
  isCompleted,
  editMode,
  initialValid,
  completionSuccessMessage,
  onViewElement,
  onRestartForm,
  onCloseWizard,
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
      | PracticeQuizFormValues,
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
    <Formik
      initialValues={initialValues}
      onSubmit={handleSubmit}
      validationSchema={step.props.validationSchema}
      isInitialValid={initialValid}
      enableReinitialize
    >
      {({ values, isSubmitting, isValid, resetForm, validateForm }) => (
        <Form className="border-b h-76 border-uzh-grey-60">
          <Validator stepNumber={stepNumber} validateForm={validateForm} />
          <div className="flex flex-row items-end gap-8">
            <H2 className={{ root: 'flex flex-none m-0 items-end' }}>
              {editMode
                ? t('manage.questionForms.editElement', { element: title })
                : t('manage.questionForms.createElement', { element: title })}
            </H2>
            <Workflow
              items={workflowItems}
              onClick={(_, ix) => setStepNumber(ix)}
              activeIx={stepNumber}
              // TODO: choose optimal disabled logic - allow to jump between 3 and 1 if all valid
              disabledFrom={isValid ? stepNumber + 2 : stepNumber + 1}
              minimal
              showTooltipSymbols
              className={{
                item: 'last:rounded-r-md first:rounded-l-md',
              }}
            />
          </div>

          <div className="flex flex-col justify-between gap-1 py-4 md:h-60">
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
              >
                {customCompletionAction}
              </CompletionStep>
            )}

            {!isCompleted && (
              <div className="flex flex-row justify-between pt-2">
                <Button
                  className={{ root: 'border-red-400' }}
                  onClick={() => onCloseWizard()}
                  data={{ cy: 'cancel-session-creation' }}
                >
                  <FontAwesomeIcon icon={faCancel} />
                  <div>
                    {editMode
                      ? t('manage.questionForms.cancelEditing')
                      : t('manage.questionForms.cancelCreation')}
                  </div>
                </Button>
                <Button
                  disabled={isSubmitting || !isValid}
                  type="submit"
                  data={{ cy: 'next-or-submit' }}
                  className={{ root: 'w-max self-end' }}
                >
                  {stepNumber === steps.length - 1 ? (
                    <FontAwesomeIcon icon={faSave} />
                  ) : (
                    <FontAwesomeIcon icon={faArrowRight} />
                  )}
                  {stepNumber === steps.length - 1
                    ? editMode
                      ? t('shared.generic.save')
                      : t('shared.generic.create')
                    : t('shared.generic.continue')}
                </Button>
              </div>
            )}
          </div>
        </Form>
      )}
    </Formik>
  )
}

export const WizardStep = ({ children }: any) => children

export default MultistepWizard
