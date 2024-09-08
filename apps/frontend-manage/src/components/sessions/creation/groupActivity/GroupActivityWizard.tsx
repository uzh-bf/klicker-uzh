import { useMutation } from '@apollo/client'
import {
  CreateGroupActivityDocument,
  EditGroupActivityDocument,
  Element,
  ElementType,
  GroupActivity,
  ParameterType,
} from '@klicker-uzh/graphql/dist/ops'
import dayjs from 'dayjs'
import { FormikProps } from 'formik'
import { findIndex } from 'lodash'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Dispatch, SetStateAction, useCallback, useRef, useState } from 'react'
import * as yup from 'yup'
import ElementCreationErrorToast from '../../../toasts/ElementCreationErrorToast'
import CompletionStep from '../CompletionStep'
import { ElementSelectCourse } from '../ElementCreation'
import WizardLayout, {
  ElementStackFormValues,
  GroupActivityClueFormValues,
  GroupActivityFormValues,
} from '../WizardLayout'
import GroupActivityDescriptionStep from './GroupActivityDescriptionStep'
import GroupActivityInformationStep from './GroupActivityInformationStep'
import GroupActivitySettingsStep from './GroupActivitySettingsStep'
import GroupActivityStackClues from './GroupActivityStackClues'
import submitGroupActivityForm from './submitGroupActivityForm'

export interface GroupActivityWizardStepProps {
  editMode: boolean
  formRef: any
  formData: GroupActivityFormValues
  continueDisabled: boolean
  activeStep: number
  stepValidity: boolean[]
  validationSchema: any
  gamifiedCourses?: ElementSelectCourse[]
  nonGamifiedCourses?: ElementSelectCourse[]
  onSubmit?: (newValues: GroupActivityFormValues) => void
  setStepValidity: Dispatch<SetStateAction<boolean[]>>
  onPrevStep?: (newValues: GroupActivityFormValues) => void
  onNextStep?: (newValues: GroupActivityFormValues) => void
  closeWizard: () => void
}

const acceptedTypes = [
  ElementType.Sc,
  ElementType.Mc,
  ElementType.Kprim,
  ElementType.Numerical,
  ElementType.FreeText,
  ElementType.Content,
]

interface GroupActivityWizardProps {
  title: string
  closeWizard: () => void
  gamifiedCourses: ElementSelectCourse[]
  nonGamifiedCourses: ElementSelectCourse[]
  selection: Record<number, Element>
  resetSelection: () => void
  initialValues?: GroupActivity
}

function GroupActivityWizard({
  title,
  closeWizard,
  gamifiedCourses,
  nonGamifiedCourses,
  selection,
  resetSelection,
  initialValues,
}: GroupActivityWizardProps) {
  const router = useRouter()
  const t = useTranslations()

  const [errorToastOpen, setErrorToastOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [isWizardCompleted, setIsWizardCompleted] = useState(false)
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>(
    undefined
  )
  const [activeStep, setActiveStep] = useState(0)
  const [stepValidity, setStepValidity] = useState(
    Array(4).fill(!!initialValues)
  )
  const formRef = useRef<FormikProps<GroupActivityFormValues>>(null)

  const nameValidationSchema = yup.object().shape({
    name: yup
      .string()
      .required(t('manage.sessionForms.groupActivityNameError')),
  })

  const descriptionValidationSchema = yup.object().shape({
    displayName: yup
      .string()
      .required(t('manage.sessionForms.groupActivityDisplayNameError')),
    description: yup
      .string()
      .required(t('manage.sessionForms.groupActivityDescriptionError')),
  })

  const settingsValidationSchema = yup.object().shape({
    startDate: yup.date().required(t('manage.sessionForms.startDate')),
    endDate: yup
      .date()
      .min(yup.ref('startDate'), t('manage.sessionForms.endAfterStart'))
      .required(t('manage.sessionForms.endDate')),
    multiplier: yup
      .string()
      .matches(/^[0-9]+$/, t('manage.sessionForms.validMultiplicator')),
    courseId: yup
      .string()
      .required(t('manage.sessionForms.groupActivityCourse')),
  })

  const stackCluesValiationSchema = yup.object().shape({
    stack: yup.object().shape({
      elementIds: yup
        .array()
        .of(yup.number())
        .min(1, t('manage.sessionForms.minOneQuestionGroupActivity')),
      titles: yup.array().of(yup.string()),
      types: yup
        .array()
        .of(
          yup
            .string()
            .oneOf(acceptedTypes, t('manage.sessionForms.groupActivityTypes'))
        ),
    }),
    clues: yup
      .array()
      .of(
        yup.object().shape({
          name: yup
            .string()
            .required(t('manage.sessionForms.clueNameMissing'))
            .test({
              message: t('manage.sessionForms.groupActivityCluesUniqueNames'),
              test: function (value) {
                const { from } = this
                const clues = from?.[1].value
                  .clues as GroupActivityClueFormValues[]
                const isUnique =
                  clues.filter((clue) => clue.name === value).length <= 1
                return isUnique
              },
            }),
          displayName: yup
            .string()
            .required(t('manage.sessionForms.clueDisplayNameMissing')),
          type: yup
            .string()
            .oneOf([ParameterType.String, ParameterType.Number]),
          value: yup
            .string()
            .required(t('manage.sessionForms.clueValueMissing')),
          unit: yup.string(),
        })
      )
      .min(2, t('manage.sessionForms.groupActivityMin2Clues')),
  })

  const formDefaultValues = {
    name: '',
    displayName: '',
    description: '',
    clues: [],
    stack: {
      displayName: '',
      description: '',
      elementIds: [],
      titles: [],
      types: [],
      hasSampleSolutions: [],
    },
    startDate: dayjs().local().add(1, 'days').format('YYYY-MM-DDTHH:mm'),
    endDate: dayjs().add(8, 'days').format('YYYY-MM-DDTHH:mm'),
    multiplier: '1',
    courseId: undefined,
  }

  const workflowItems = [
    {
      title: t('shared.generic.information'),
      tooltip: t('manage.sessionForms.groupActivityInformation'),
    },
    {
      title: t('shared.generic.description'),
      tooltip: t('manage.sessionForms.groupActivityDescription'),
    },
    {
      title: t('shared.generic.settings'),
      tooltip: t('manage.sessionForms.groupActivitySettings'),
      tooltipDisabled: t('manage.sessionForms.checkValues'),
    },
    {
      title: t('shared.generic.questions'),
      tooltip: t('manage.sessionForms.groupActivityQuestions'),
      tooltipDisabled: t('manage.sessionForms.checkValues'),
    },
  ]

  const [formData, setFormData] = useState<GroupActivityFormValues>({
    name: initialValues?.name || formDefaultValues.name,
    displayName: initialValues?.displayName || formDefaultValues.displayName,
    description: initialValues?.description || formDefaultValues.description,
    clues:
      initialValues?.clues?.map((clue) => {
        return {
          name: clue.name,
          displayName: clue.displayName,
          type: clue.type,
          value: clue.value,
          unit: clue.unit ?? undefined,
        }
      }) ?? formDefaultValues.clues,
    stack: initialValues?.stacks
      ? {
          displayName: initialValues?.stacks[0].displayName ?? '',
          description: initialValues?.stacks[0].description ?? '',
          ...initialValues?.stacks[0].elements!.reduce(
            (acc: ElementStackFormValues, element) => {
              acc.elementIds.push(parseInt(element.elementData.id))
              acc.titles.push(element.elementData.name)
              acc.types.push(element.elementData.type)
              return acc
            },
            {
              elementIds: [],
              titles: [],
              types: [],
              hasSampleSolutions: [],
            }
          ),
        }
      : formDefaultValues.stack,

    startDate: initialValues?.scheduledStartAt
      ? dayjs(initialValues?.scheduledStartAt)
          .local()
          .format('YYYY-MM-DDTHH:mm')
      : formDefaultValues.startDate,
    endDate: initialValues?.scheduledEndAt
      ? dayjs(initialValues?.scheduledEndAt).local().format('YYYY-MM-DDTHH:mm')
      : formDefaultValues.endDate,
    multiplier: initialValues?.pointsMultiplier
      ? String(initialValues?.pointsMultiplier)
      : formDefaultValues.multiplier,
    courseId: initialValues?.course?.id || formDefaultValues.courseId,
  })

  const [createGroupActivity] = useMutation(CreateGroupActivityDocument)
  const [editGroupActivity] = useMutation(EditGroupActivityDocument)
  const handleSubmit = useCallback(
    async (values: GroupActivityFormValues) => {
      submitGroupActivityForm({
        id: initialValues?.id,
        values,
        createGroupActivity,
        editGroupActivity,
        setEditMode,
        setIsWizardCompleted,
        setErrorToastOpen,
        setSelectedCourseId,
      })
    },
    [createGroupActivity, editGroupActivity, initialValues?.id]
  )

  return (
    <>
      <WizardLayout
        title={title}
        editMode={editMode}
        activeStep={activeStep}
        setActiveStep={setActiveStep}
        disabledFrom={findIndex(stepValidity, (valid) => !valid) + 1}
        workflowItems={workflowItems}
        isCompleted={isWizardCompleted}
        completionStep={
          <CompletionStep
            completionSuccessMessage={(elementName) => (
              <div>
                {editMode
                  ? t.rich('manage.sessionForms.groupActivityEdited', {
                      b: (text) => <strong>{text}</strong>,
                      name: elementName,
                    })
                  : t.rich('manage.sessionForms.groupActivityCreated', {
                      b: (text) => <strong>{text}</strong>,
                      name: elementName,
                    })}
              </div>
            )}
            name={formData.name}
            editMode={editMode}
            onViewElement={() => {
              router.push(`/courses/${selectedCourseId}?tab=groupActivities`)
            }}
            onRestartForm={() => {
              setIsWizardCompleted(false)
              closeWizard()
            }}
            resetForm={() => setFormData(formDefaultValues)}
            setStepNumber={setActiveStep}
            onCloseWizard={closeWizard}
          />
        }
        steps={[
          <GroupActivityInformationStep
            key="group-activity-information-step"
            editMode={editMode}
            formRef={formRef}
            formData={formData}
            continueDisabled={
              gamifiedCourses?.length === 0 && nonGamifiedCourses?.length === 0
            }
            activeStep={activeStep}
            stepValidity={stepValidity}
            validationSchema={nameValidationSchema}
            gamifiedCourses={gamifiedCourses}
            nonGamifiedCourses={nonGamifiedCourses}
            setStepValidity={setStepValidity}
            onNextStep={(newValues: Partial<GroupActivityFormValues>) => {
              setFormData((prev) => ({ ...prev, ...newValues }))
              setActiveStep((currentStep) => currentStep + 1)
            }}
            closeWizard={closeWizard}
          />,
          <GroupActivityDescriptionStep
            key="group-activity-description-step"
            editMode={editMode}
            formRef={formRef}
            formData={formData}
            continueDisabled={false}
            activeStep={activeStep}
            stepValidity={stepValidity}
            validationSchema={descriptionValidationSchema}
            setStepValidity={setStepValidity}
            onNextStep={(newValues: Partial<GroupActivityFormValues>) => {
              setFormData((prev) => ({ ...prev, ...newValues }))
              setActiveStep((currentStep) => currentStep + 1)
            }}
            onPrevStep={(newValues: Partial<GroupActivityFormValues>) => {
              setFormData((prev) => ({ ...prev, ...newValues }))
              setActiveStep((currentStep) => currentStep - 1)
            }}
            closeWizard={closeWizard}
          />,
          <GroupActivitySettingsStep
            key="group-activity-settings-step"
            editMode={editMode}
            formRef={formRef}
            formData={formData}
            continueDisabled={false}
            activeStep={activeStep}
            stepValidity={stepValidity}
            validationSchema={settingsValidationSchema}
            gamifiedCourses={gamifiedCourses}
            nonGamifiedCourses={nonGamifiedCourses}
            setStepValidity={setStepValidity}
            onNextStep={(newValues: Partial<GroupActivityFormValues>) => {
              setFormData((prev) => ({ ...prev, ...newValues }))
              setActiveStep((currentStep) => currentStep + 1)
            }}
            onPrevStep={(newValues: Partial<GroupActivityFormValues>) => {
              setFormData((prev) => ({ ...prev, ...newValues }))
              setActiveStep((currentStep) => currentStep - 1)
            }}
            closeWizard={closeWizard}
          />,
          <GroupActivityStackClues
            key="group-activity-stack-clues"
            editMode={editMode}
            selection={selection}
            resetSelection={resetSelection}
            acceptedTypes={acceptedTypes}
            formRef={formRef}
            formData={formData}
            continueDisabled={false}
            activeStep={activeStep}
            stepValidity={stepValidity}
            validationSchema={stackCluesValiationSchema}
            setStepValidity={setStepValidity}
            onPrevStep={(newValues: Partial<GroupActivityFormValues>) => {
              setFormData((prev) => ({ ...prev, ...newValues }))
              setActiveStep((currentStep) => currentStep - 1)
            }}
            onSubmit={(newValues: GroupActivityFormValues) =>
              handleSubmit({ ...formData, ...newValues })
            }
            closeWizard={closeWizard}
          />,
        ]}
        saveFormData={() => {
          setFormData((prev) => ({ ...prev, ...formRef.current?.values }))
        }}
      />
      <ElementCreationErrorToast
        open={errorToastOpen}
        setOpen={setErrorToastOpen}
        error={
          editMode
            ? t('manage.sessionForms.groupActivityEditingFailed')
            : t('manage.sessionForms.groupActivityCreationFailed')
        }
      />
    </>
  )
}

export default GroupActivityWizard
