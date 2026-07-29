import { useMutation } from '@apollo/client'
import {
  ActivityType,
  CreateGroupActivityDocument,
  EditGroupActivityDocument,
  Element,
  GroupActivity,
  ParameterType,
} from '@klicker-uzh/graphql/dist/ops'
import { toast } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { FormikProps } from 'formik'
import { findIndex } from 'lodash'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useCallback, useRef, useState } from 'react'
import * as yup from 'yup'
import useCoursesGroupActivitySplit from '../../../../lib/hooks/useCoursesGroupActivitySplit'
import { ElementSelectCourse } from '../../ActivityCreation'
import { getActivityAcceptedElementTypes } from '../activityAcceptedElementTypes'
import CompletionStep from '../CompletionStep'
import { useEscapeRoomYupFields } from '../escapeRoomValidation'
import WizardLayout, {
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
  coursesWithGroups?: ElementSelectCourse[]
  assessmentCoursesWithGroups?: ElementSelectCourse[]
  coursesWithoutGroups?: ElementSelectCourse[]
  onSubmit?: (newValues: GroupActivityFormValues) => Promise<void>
  setStepValidity: Dispatch<SetStateAction<boolean[]>>
  onPrevStep?: (newValues: GroupActivityFormValues) => void
  onNextStep?: (newValues: GroupActivityFormValues) => void
  closeWizard: () => void
}

const acceptedTypes = getActivityAcceptedElementTypes(
  ActivityType.GroupActivity
)

interface GroupActivityWizardProps {
  title: string
  closeWizard: () => void
  courses: ElementSelectCourse[]
  selection: Record<number, Element>
  resetSelection: () => void
  initialValues?: GroupActivity
  editMode: boolean
  duplicationMode: boolean
  escapeRoomHints: Array<{ instanceId: number; hint: string }>
}

function GroupActivityWizard({
  title,
  closeWizard,
  courses,
  selection,
  resetSelection,
  initialValues,
  editMode,
  duplicationMode,
  escapeRoomHints,
}: GroupActivityWizardProps) {
  const t = useTranslations()
  const [isWizardCompleted, setIsWizardCompleted] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [stepValidity, setStepValidity] = useState<boolean[]>(
    Array(4).fill(!!initialValues)
  )
  const formRef = useRef<FormikProps<GroupActivityFormValues>>(null)

  const {
    coursesWithGroups,
    assessmentCoursesWithGroups,
    coursesWithoutGroups,
  } = useCoursesGroupActivitySplit({
    courseSelection: courses,
  })
  const escapeRoomYupFields = useEscapeRoomYupFields()
  const escapeRoomHintMap = new Map(
    escapeRoomHints.map(({ instanceId, hint }) => [instanceId, hint])
  )

  const nameValidationSchema = yup.object().shape({
    name: yup
      .string()
      .required(t('manage.activityWizard.groupActivityNameError')),
  })

  const descriptionValidationSchema = yup.object().shape({
    displayName: yup
      .string()
      .required(t('manage.activityWizard.groupActivityDisplayNameError')),
    description: yup
      .string()
      .required(t('manage.activityWizard.groupActivityDescriptionError')),
  })

  const settingsValidationSchema = yup.object().shape({
    startDate: yup
      .date()
      .required(t('manage.activityWizard.groupActivityStartDate'))
      .test(
        'afterCourseStart',
        t('manage.activityWizard.groupActivityStartAfterCourseStart'),
        (value, context) =>
          context.parent.courseStartDate
            ? dayjs(value) > dayjs(context.parent.courseStartDate)
            : true
      )
      .test(
        'afterGroupDeadline',
        t('manage.activityWizard.groupActivityStartAfterGroupDeadline'),
        (value, context) =>
          context.parent.courseGroupDeadline
            ? dayjs(value) > dayjs(context.parent.courseGroupDeadline)
            : true
      ),
    endDate: yup
      .date()
      .required(t('manage.activityWizard.groupActivityEndDate'))
      .min(yup.ref('startDate'), t('manage.activityWizard.endAfterStart'))
      .test(
        'beforeCourseEnd',
        t('manage.activityWizard.groupActivityEndBeforeCourseEnd'),
        (value, context) =>
          context.parent.courseEndDate
            ? dayjs(value) < dayjs(context.parent.courseEndDate)
            : true
      ),
    multiplier: yup
      .string()
      .matches(/^[0-9]+$/, t('manage.activityWizard.validMultiplicator')),
    courseId: yup
      .string()
      .required(t('manage.activityWizard.groupActivityCourse')),
    ...escapeRoomYupFields,
  })

  const stackCluesValiationSchema = yup.object().shape({
    stack: yup.object().shape({
      elements: yup
        .array()
        .min(1, t('manage.activityWizard.minOneQuestionGroupActivity'))
        .of(
          yup.object().shape({
            id: yup.number(),
            title: yup.string(),
            type: yup
              .string()
              .oneOf(
                [...acceptedTypes, ElementType.QrScan],
                t('manage.activityWizard.groupActivityTypes')
              ),
            hasSampleSolution: yup.boolean().test({
              name: 'groupEscapeRoomSampleSolution',
              message: t('manage.activityWizard.elementSolutionReq'),
              test: function (value) {
                const rootValues = this.from?.find(
                  (entry) =>
                    typeof entry.value === 'object' &&
                    entry.value !== null &&
                    'isEscapeRoom' in entry.value
                )?.value as GroupActivityFormValues | undefined
                const type = this.parent.type as ElementType
                const requiresSampleSolution =
                  rootValues?.isEscapeRoom &&
                  type !== ElementType.Content &&
                  type !== ElementType.QrScan
                return !requiresSampleSolution || value === true
              },
            }),
          })
        ),
    }),
    clues: yup
      .array()
      .of(
        yup.object().shape({
          name: yup
            .string()
            .required(t('manage.activityWizard.clueNameMissing'))
            .test({
              message: t('manage.activityWizard.groupActivityCluesUniqueNames'),
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
            .required(t('manage.activityWizard.clueDisplayNameMissing')),
          type: yup
            .string()
            .oneOf([ParameterType.String, ParameterType.Number]),
          value: yup
            .string()
            .required(t('manage.activityWizard.clueValueMissing')),
          unit: yup.string(),
        })
      )
      .min(2, t('manage.activityWizard.groupActivityMin2Clues')),
  })

  const formDefaultValues = {
    name: '',
    displayName: '',
    description: '',
    clues: [],
    stack: {
      displayName: '',
      description: '',
      elements: [],
    },
    startDate: dayjs()
      .startOf('month')
      .add(1, 'month')
      .add(12, 'hours')
      .toDate(),
    endDate: dayjs()
      .startOf('month')
      .add(1, 'month')
      .add(7, 'day')
      .add(12, 'hours')
      .toDate(),
    multiplier: '1',
    courseId: undefined,
    courseStartDate: undefined,
    courseEndDate: undefined,
    courseGroupDeadline: undefined,
    isEscapeRoom: false,
    escapeRoomTimeLimit: '60',
    escapeRoomHintPenalty: '0',
    escapeRoomIntroText: '',
  }

  const workflowItems = [
    {
      title: t('shared.generic.information'),
      tooltip: t('manage.activityWizard.groupActivityInformation'),
      completed: stepValidity[0],
    },
    {
      title: t('shared.generic.description'),
      tooltip: t('manage.activityWizard.groupActivityDescription'),
      completed: stepValidity[1],
    },
    {
      title: t('shared.generic.settings'),
      tooltip: t('manage.activityWizard.groupActivitySettings'),
      tooltipDisabled: t('manage.activityWizard.checkValues'),
      completed: stepValidity[2],
    },
    {
      title: t('shared.generic.questions'),
      tooltip: t('manage.activityWizard.groupActivityQuestions'),
      tooltipDisabled: t('manage.activityWizard.checkValues'),
      completed: stepValidity[3],
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
          elements: initialValues?.stacks[0].elements!.map((instance) => {
            const [elementId, _] = instance.elementData.id.split('-v')

            return {
              id: parseInt(elementId, 10),
              title: instance.elementData.name,
              type: instance.elementData.type,
              hasSampleSolution:
                'options' in instance.elementData
                  ? (instance.elementData.options.hasSampleSolution ?? false)
                  : true,
              existingInstanceId: instance.id,
              duplicateInstance: duplicationMode,
              escapeRoomHint: escapeRoomHintMap.get(instance.id),
            }
          }),
        }
      : formDefaultValues.stack,

    startDate: initialValues?.scheduledStartAt
      ? dayjs(initialValues?.scheduledStartAt).local().toDate()
      : formDefaultValues.startDate,
    endDate: initialValues?.scheduledEndAt
      ? dayjs(initialValues?.scheduledEndAt).local().toDate()
      : formDefaultValues.endDate,
    courseStartDate: formDefaultValues.courseStartDate,
    courseEndDate: formDefaultValues.courseEndDate,
    courseGroupDeadline: formDefaultValues.courseGroupDeadline,
    multiplier: initialValues?.pointsMultiplier
      ? String(initialValues?.pointsMultiplier)
      : formDefaultValues.multiplier,
    courseId: initialValues?.course?.id || formDefaultValues.courseId,
    isEscapeRoom: !!initialValues?.escapeRoomConfig,
    escapeRoomTimeLimit: initialValues?.escapeRoomConfig?.timeLimit
      ? String(Math.round(initialValues.escapeRoomConfig.timeLimit / 60))
      : formDefaultValues.escapeRoomTimeLimit,
    escapeRoomHintPenalty:
      typeof initialValues?.escapeRoomConfig?.hintPenalty !== 'undefined' &&
      initialValues?.escapeRoomConfig?.hintPenalty !== null
        ? String(initialValues.escapeRoomConfig.hintPenalty)
        : formDefaultValues.escapeRoomHintPenalty,
    escapeRoomIntroText:
      initialValues?.escapeRoomConfig?.introText ??
      formDefaultValues.escapeRoomIntroText,
  })

  // QR scan questions are only placeable in escape-room activities
  const stackAcceptedTypes = formData.isEscapeRoom
    ? [...acceptedTypes, ElementType.QrScan]
    : acceptedTypes

  const [createGroupActivity, { data: creationData }] = useMutation(
    CreateGroupActivityDocument
  )
  const [editGroupActivity, { data: editingData }] = useMutation(
    EditGroupActivityDocument
  )

  const handleSubmit = useCallback(
    (values: GroupActivityFormValues) => {
      return submitGroupActivityForm({
        id: initialValues?.id,
        previousCourseId: initialValues?.course?.id,
        values,
        createGroupActivity,
        editGroupActivity,
        setIsWizardCompleted,
        onError: () =>
          toast({
            type: 'error',
            message: (
              <div>
                <div>
                  {editMode
                    ? t('manage.activityWizard.groupActivityEditingFailed')
                    : t('manage.activityWizard.groupActivityCreationFailed')}
                </div>
                <div>{t('manage.activityWizard.considerFormErrors')}</div>
              </div>
            ),
            options: { duration: 6000 },
          }),
      })
    },
    [createGroupActivity, editGroupActivity, initialValues?.id]
  )

  const selectedCourseId =
    creationData?.createGroupActivity?.courseId ??
    editingData?.editGroupActivity?.courseId
  const isActivityReviewer =
    creationData?.createGroupActivity?.isActivityReviewer ??
    editingData?.editGroupActivity?.isActivityReviewer

  return (
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
                ? t.rich('manage.activityWizard.groupActivityEdited', {
                    b: (text) => <strong>{text}</strong>,
                    name: elementName,
                  })
                : t.rich('manage.activityWizard.groupActivityCreated', {
                    b: (text) => <strong>{text}</strong>,
                    name: elementName,
                  })}
            </div>
          )}
          name={formData.name}
          editMode={editMode}
          viewElementHref={
            isActivityReviewer
              ? `/courses/${selectedCourseId}?tab=groupActivities`
              : '/activities'
          }
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
          activeStep={activeStep}
          stepValidity={stepValidity}
          validationSchema={nameValidationSchema}
          coursesWithGroups={coursesWithGroups}
          coursesWithoutGroups={coursesWithoutGroups}
          continueDisabled={coursesWithGroups?.length === 0}
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
          coursesWithGroups={coursesWithGroups}
          assessmentCoursesWithGroups={assessmentCoursesWithGroups}
          coursesWithoutGroups={coursesWithoutGroups}
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
          isEscapeRoom={formData.isEscapeRoom}
          acceptedTypes={stackAcceptedTypes}
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
  )
}

export default GroupActivityWizard
