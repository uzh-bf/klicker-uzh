import { useMutation } from '@apollo/client'
import {
  CreateGroupActivityDocument,
  EditGroupActivityDocument,
  Element,
  ElementType,
  GroupActivity,
  ParameterType,
} from '@klicker-uzh/graphql/dist/ops'
import { toast } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { FormikProps } from 'formik'
import { findIndex, isEqual, omit } from 'lodash'
import { useTranslations } from 'next-intl'
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  buildSnapshotKey,
  clearLegacyUnscopedSnapshots,
  clearWizardSnapshot,
  hasWizardSnapshot,
  loadWizardSnapshot,
  saveWizardSnapshot,
  useWizardUserKey,
} from '@lib/activityWizardRecovery'
import * as yup from 'yup'
import useCoursesGroupActivitySplit from '../../../../lib/hooks/useCoursesGroupActivitySplit'
import { ElementSelectCourse } from '../../ActivityCreation'
import CompletionStep from '../CompletionStep'
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

const acceptedTypes = [
  ElementType.Sc,
  ElementType.Mc,
  ElementType.Kprim,
  ElementType.Numerical,
  ElementType.FreeText,
  ElementType.Content,
  ElementType.Selection,
  ElementType.CaseStudy,
]

interface GroupActivityWizardProps {
  title: string
  closeWizard: () => void
  courses: ElementSelectCourse[]
  selection: Record<number, Element>
  resetSelection: () => void
  restoreSelection: (selection: Record<number, Element>) => void
  initialValues?: GroupActivity
  editMode: boolean
  duplicationMode: boolean
}

function GroupActivityWizard({
  title,
  closeWizard,
  courses,
  selection,
  resetSelection,
  restoreSelection,
  initialValues,
  editMode,
  duplicationMode,
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
                acceptedTypes,
                t('manage.activityWizard.groupActivityTypes')
              ),
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
              id: parseInt(elementId),
              title: instance.elementData.name,
              type: instance.elementData.type,
              hasSampleSolution: false,
              existingInstanceId: instance.id,
              duplicateInstance: duplicationMode,
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
  })

  const initialDataRef = useRef(formData)
  const isWizardDirty = useCallback(() => {
    // Derived course metadata is populated automatically from the selected
    // course when the settings step mounts and is never user-authored, so
    // it must not trip the dirty decision on a pristine edit-mode visit.
    const derivedFields = [
      'courseStartDate',
      'courseEndDate',
      'courseGroupDeadline',
    ]
    const merged = {
      ...initialDataRef.current,
      ...formData,
      ...formRef.current?.values,
    }
    const hasSelection = Object.keys(selection).length > 0

    return (
      hasSelection ||
      !isEqual(
        omit(initialDataRef.current, derivedFields),
        omit(merged, derivedFields)
      )
    )
  }, [formData, selection])

  const userKey = useWizardUserKey()
  const recoveryOptions = {
    userKey,
    mode: editMode
      ? ('edit' as const)
      : duplicationMode
        ? ('duplicate' as const)
        : ('create' as const),
    activityType: 'GROUP_ACTIVITY',
    sourceId: initialValues?.id ? String(initialValues.id) : undefined,
  }
  const recoveryKey = buildSnapshotKey(recoveryOptions)
  const isClosingRef = useRef(false)
  const hasPersistedSnapshotRef = useRef(false)
  const [recoveryAvailable, setRecoveryAvailable] = useState(() =>
    hasWizardSnapshot(recoveryOptions)
  )

  // Snapshots written before user scoping cannot be attributed to an
  // account, so drop them once on mount instead of offering them back.
  useEffect(() => {
    clearLegacyUnscopedSnapshots()
  }, [])

  // The user key resolves asynchronously from the profile query; re-check
  // for a snapshot when it lands so a saved draft is still offered.
  useEffect(() => {
    setRecoveryAvailable(hasWizardSnapshot(recoveryOptions))
  }, [recoveryKey])

  // Persist merged wizard state so a reload mid-wizard can recover even
  // though reload never passes through the cancel path.
  // Steps commit their values to formData only on navigation, so sample
  // the live Formik values on an interval to observe edits made on the
  // currently mounted step and let the debounced save below pick them up.
  useEffect(() => {
    if (isWizardCompleted || editMode || recoveryAvailable) {
      return
    }

    const sampler = setInterval(() => {
      setFormData((prev) => {
        const merged = { ...prev, ...formRef.current?.values }
        return isEqual(prev, merged) ? prev : merged
      })
    }, 1000)

    return () => clearInterval(sampler)
  }, [isWizardCompleted, editMode, recoveryAvailable])

  useEffect(() => {
    if (isWizardCompleted || editMode || recoveryAvailable) {
      return
    }

    const wizardDirty = isWizardDirty()
    if (!wizardDirty) {
      // Only clear a snapshot written by this mounted wizard. An existing
      // recovery candidate must survive until the lecturer explicitly loads
      // or discards it.
      if (hasPersistedSnapshotRef.current) {
        clearWizardSnapshot(recoveryOptions)
        hasPersistedSnapshotRef.current = false
        setRecoveryAvailable(false)
      }
      return
    }

    const timer = setTimeout(() => {
      if (isClosingRef.current) {
        return
      }
      const merged = { ...formData, ...formRef.current?.values }
      if (
        saveWizardSnapshot({
          ...recoveryOptions,
          values: merged,
          selectedElements: selection,
        })
      ) {
        hasPersistedSnapshotRef.current = true
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [
    formData,
    isWizardCompleted,
    editMode,
    recoveryAvailable,
    recoveryKey,
    selection,
  ])

  // Clear the snapshot once the wizard completes so a finished activity is
  // never offered for recovery afterwards.
  useEffect(() => {
    if (isWizardCompleted) {
      clearWizardSnapshot(recoveryOptions)
      setRecoveryAvailable(false)
    }
  }, [isWizardCompleted, recoveryKey])

  const handleRecover = () => {
    const restored =
      loadWizardSnapshot<GroupActivityFormValues>(recoveryOptions)

    if (restored) {
      setFormData((prev) => ({ ...prev, ...restored.values }))
      // Steps mount their own Formik from formData only at mount time; also
      // push the restored values into the live form so recovery is visible
      // immediately on the step where the prompt was answered.
      formRef.current?.setValues({
        ...formRef.current?.values,
        ...restored.values,
      })
      if (restored.selectedElements) {
        restoreSelection(restored.selectedElements)
      }
    }

    setRecoveryAvailable(false)
  }

  const handleDiscardRecovery = () => {
    clearWizardSnapshot(recoveryOptions)
    setRecoveryAvailable(false)
  }

  // Closing the wizard is an explicit decision: a clean cancel removes the
  // snapshot the debounced autosave wrote for this wizard so the next entry
  // starts fresh, and a confirmed dirty cancel means the user discarded the
  // draft. The completion screen clears its own snapshot separately.
  const closeWizardAndClearSnapshot = useCallback(() => {
    // A debounce scheduled while dirty can come due after this handler;
    // flag the close first so it cannot re-persist the discarded snapshot.
    isClosingRef.current = true
    clearWizardSnapshot(recoveryOptions)
    closeWizard()
  }, [closeWizard, recoveryKey])

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
      isDirty={isWizardDirty}
      recoveryAvailable={recoveryAvailable && !editMode}
      onRecover={handleRecover}
      onDiscardRecovery={handleDiscardRecovery}
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
          onCloseWizard={closeWizardAndClearSnapshot}
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
          closeWizard={closeWizardAndClearSnapshot}
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
          closeWizard={closeWizardAndClearSnapshot}
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
          closeWizard={closeWizardAndClearSnapshot}
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
          closeWizard={closeWizardAndClearSnapshot}
        />,
      ]}
      saveFormData={() => {
        setFormData((prev) => ({ ...prev, ...formRef.current?.values }))
      }}
    />
  )
}

export default GroupActivityWizard
