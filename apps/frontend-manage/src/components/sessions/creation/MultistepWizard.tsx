import {
  faArrowRight,
  faCancel,
  faSave,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementOrderType,
  ElementType,
  ParameterType,
} from '@klicker-uzh/graphql/dist/ops'
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
  continueDisabled?: boolean
}

export type GroupActivityClueFormValues =
  | {
      name: string
      displayName: string
      type: ParameterType.String
      value: string
    }
  | {
      name: string
      displayName: string
      type: ParameterType.Number
      value: string
      unit: string
    }

interface CommonFormValues {
  name: string
  displayName: string
  description: string
  courseId: string
  multiplier: string
}

export interface LiveQuizBlockFormValues {
  questionIds: number[]
  titles: string[]
  types: ElementType[]
  timeLimit?: number
}

export interface LiveQuizBlockErrorValues {
  questionIds?: string[]
  titles?: string[]
  types?: string[]
  timeLimit?: string
}

export interface ElementStackFormValues {
  displayName?: string
  description?: string
  elementIds: number[]
  titles: string[]
  types: ElementType[]
  hasSampleSolutions: boolean[]
}

export interface ElementStackErrorValues {
  displayName: string
  description: string
  elementIds: string[]
  titles: string[]
  types: string[]
  hasSampleSolutions: string[]
}

export interface LiveSessionFormValues extends CommonFormValues {
  blocks: LiveQuizBlockFormValues[]
  isGamificationEnabled: boolean
  isConfusionFeedbackEnabled: boolean
  isLiveQAEnabled: boolean
  isModerationEnabled: boolean
}

export interface MicroLearningFormValues extends CommonFormValues {
  stacks: ElementStackFormValues[]
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
  availableFrom?: string
  resetTimeDays: string
}

export interface GroupActivityFormValues extends CommonFormValues {
  questions: {
    id: number
    title: string
    hasAnswerFeedbacks: boolean
    hasSampleSolution: boolean
  }[]
  startDate: string
  endDate: string
  clues: GroupActivityClueFormValues[]
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
  continueDisabled,
}: MultistepWizardProps) {
  const t = useTranslations()
  const [stepNumber, setStepNumber] = useState(0)
  const steps = React.Children.toArray(children)
  const step = steps[stepNumber] as React.ReactElement

  const handleSubmit = async (
    values:
      | LiveSessionFormValues
      | MicroLearningFormValues
      | PracticeQuizFormValues
      | GroupActivityFormValues,
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
    >
      {({ values, isSubmitting, isValid, resetForm, validateForm }) => (
        <Form className="h-full w-full flex flex-col">
          <Validator stepNumber={stepNumber} validateForm={validateForm} />
          <div className="flex flex-row items-end gap-8 h-6">
            <H2 className={{ root: 'flex flex-none m-0 items-end' }}>
              {editMode
                ? t('manage.questionForms.editElement', { element: title })
                : t('manage.questionForms.createElement', { element: title })}
            </H2>
            <Workflow
              minimal
              showTooltipSymbols
              items={workflowItems}
              onClick={(_, ix) => setStepNumber(ix)}
              activeIx={stepNumber}
              // TODO: validation on mount potentially broken for description step
              // TODO: choose optimal disabled logic - allow to jump between 3 and 1 if all valid
              disabledFrom={
                continueDisabled ? 1 : isValid ? stepNumber + 2 : stepNumber + 1
              }
              className={{
                item: 'last:rounded-r-md first:rounded-l-md hidden md:flex',
              }}
            />
          </div>

          <div className="flex flex-1 w-full justify-between gap-1 py-4">
            {!isCompleted && (
              <div className="flex flex-col justify-between w-full h-full">
                <div>{step}</div>
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
                    disabled={isSubmitting || !isValid || continueDisabled}
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
              </div>
            )}

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
          </div>
        </Form>
      )}
    </Formik>
  )
}

export const WizardStep = ({ children }: any) => children

export default MultistepWizard
