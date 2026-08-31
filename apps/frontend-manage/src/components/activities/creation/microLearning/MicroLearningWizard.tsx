import { useMutation } from '@apollo/client'
import {
  CreateMicroLearningDocument,
  EditMicroLearningDocument,
  Element,
  ElementType,
  MicroLearning,
} from '@klicker-uzh/graphql/dist/ops'
import useCoursesGamificationSplit from '@lib/hooks/useCoursesGamificationSplit'
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
import { ElementSelectCourse } from '../../ActivityCreation'
import CompletionStep from '../CompletionStep'
import StackCreationStep from '../StackCreationStep'
import WizardLayout, { MicroLearningFormValues } from '../WizardLayout'
import MicroLearningDescriptionStep from './MicroLearningDescriptionStep'
import MicroLearningInformationStep from './MicroLearningInformationStep'
import MicroLearningSettingsStep from './MicroLearningSettingsStep'
import submitMicrolearningForm from './submitMicrolearningForm'

export interface MicroLearningWizardStepProps {
  editMode: boolean
  formRef: any
  formData: MicroLearningFormValues
  continueDisabled: boolean
  activeStep: number
  stepValidity: boolean[]
  validationSchema: any
  gamifiedCourses?: ElementSelectCourse[]
  nonGamifiedCourses?: ElementSelectCourse[]
  assessmentCourses?: ElementSelectCourse[]
  onSubmit?: (newValues: MicroLearningFormValues) => Promise<void>
  setStepValidity: Dispatch<SetStateAction<boolean[]>>
  onPrevStep?: (newValues: MicroLearningFormValues) => void
  onNextStep?: (newValues: MicroLearningFormValues) => void
  closeWizard: () => void
}

const acceptedTypes = [
  ElementType.Sc,
  ElementType.Mc,
  ElementType.Kprim,
  ElementType.Numerical,
  ElementType.FreeText,
  ElementType.Flashcard,
  ElementType.Content,
  ElementType.Selection,
  ElementType.CaseStudy,
]

interface MicroLearningWizardProps {
  title: string
  courses: ElementSelectCourse[]
  initialValues?: MicroLearning
  selection: Record<number, Element>
  resetSelection: () => void
  restoreSelection: (selection: Record<number, Element>) => void
  closeWizard: () => void
  editMode: boolean
  duplicationMode: boolean
}

function MicroLearningWizard({
  title,
  courses,
  initialValues,
  selection,
  resetSelection,
  restoreSelection,
  closeWizard,
  editMode,
  duplicationMode,
}: MicroLearningWizardProps) {
  const t = useTranslations()
  const [isWizardCompleted, setIsWizardCompleted] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [stepValidity, setStepValidity] = useState<boolean[]>(
    Array(4).fill(!!initialValues)
  )
  const formRef = useRef<FormikProps<MicroLearningFormValues>>(null)

  const { gamifiedCourses, nonGamifiedCourses, assessmentCourses } =
    useCoursesGamificationSplit({
      courseSelection: courses,
    })

  const nameValidationSchema = yup.object().shape({
    name: yup.string().required(t('manage.activityWizard.activityName')),
  })

  const descriptionValidationSchema = yup.object().shape({
    displayName: yup
      .string()
      .required(t('manage.activityWizard.activityDisplayName')),
    description: yup.string(),
  })

  const settingsValidationSchema = yup.object().shape({
    startDate: yup
      .date()
      .required(t('manage.activityWizard.startDate'))
      .test(
        'afterCourseStart',
        t('manage.activityWizard.microlearningStartAfterCourseStart'),
        (value, context) =>
          context.parent.courseStartDate
            ? dayjs(value) > dayjs(context.parent.courseStartDate)
            : true
      ),
    endDate: yup
      .date()
      .required(t('manage.activityWizard.endDate'))
      .test(
        'checkDateInPast',
        t('manage.activityWizard.endInFuture'),
        (date) => {
          return !!(date && date > new Date())
        }
      )
      .when('startDate', (startDate, schema) =>
        schema.min(startDate, t('manage.activityWizard.endAfterStart'))
      )
      .test(
        'beforeCourseEnd',
        t('manage.activityWizard.microlearningEndBeforeCourseEnd'),
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
      .required(t('manage.activityWizard.microlearningCourse')),
  })

  const stackValiationSchema = yup.object().shape({
    stacks: yup
      .array()
      .of(
        yup.object().shape({
          displayName: yup.string(),
          description: yup.string(),
          elements: yup
            .array()
            .min(1, t('manage.activityWizard.minOneElementPerStack'))
            .of(
              yup.object().shape({
                id: yup.number(),
                title: yup.string(),
                type: yup
                  .string()
                  .oneOf(
                    acceptedTypes,
                    t('manage.activityWizard.microlearningTypes')
                  ),
                hasSampleSolution: yup.boolean().when('type', {
                  is: (type: ElementType) => type !== ElementType.FreeText,
                  then: (schema) =>
                    schema.isTrue(
                      t('manage.activityWizard.elementSolutionReq')
                    ),
                }),
              })
            ),
        })
      )
      .min(1),
  })

  const formDefaultValues = {
    name: '',
    displayName: '',
    description: '',
    stacks: [
      {
        displayName: '',
        description: '',
        elements: [],
      },
    ],
    startDate: dayjs()
      .startOf('month')
      .add(1, 'month')
      .add(12, 'hours')
      .toDate(),
    endDate: dayjs()
      .startOf('month')
      .add(1, 'month')
      .add(1, 'day')
      .add(12, 'hours')
      .toDate(),
    courseStartDate: undefined,
    courseEndDate: undefined,
    multiplier: '1',
    courseId: undefined,
  }

  const workflowItems = [
    {
      title: t('shared.generic.information'),
      tooltip: t('manage.activityWizard.microLearningInformation'),
      completed: stepValidity[0],
    },
    {
      title: t('shared.generic.description'),
      tooltip: t('manage.activityWizard.microlearningDescription'),
      tooltipDisabled: t('manage.activityWizard.microlearningDescription'),
      completed: stepValidity[1],
    },
    {
      title: t('shared.generic.settings'),
      tooltip: t('manage.activityWizard.microlearningSettings'),
      tooltipDisabled: t('manage.activityWizard.checkValues'),
      completed: stepValidity[2],
    },
    {
      title: t('shared.generic.questions'),
      tooltip: t('manage.activityWizard.microlearningQuestions'),
      tooltipDisabled: t('manage.activityWizard.checkValues'),
      completed: stepValidity[3],
    },
  ]

  const [formData, setFormData] = useState<MicroLearningFormValues>({
    name: initialValues?.name || formDefaultValues.name,
    displayName: initialValues?.displayName || formDefaultValues.displayName,
    description: initialValues?.description || formDefaultValues.description,
    stacks: initialValues?.stacks
      ? initialValues.stacks.map((stack) => ({
          displayName: stack.displayName ?? '',
          description: stack.description ?? '',
          elements: stack.elements!.map((instance) => {
            const [elementId, _] = instance.elementData.id.split('-v')

            return {
              id: parseInt(elementId),
              title: instance.elementData.name,
              type: instance.elementData.type,
              hasSampleSolution:
                'options' in instance.elementData
                  ? (instance.elementData.options.hasSampleSolution ?? false)
                  : true,
              existingInstanceId: instance.id,
              duplicateInstance: duplicationMode,
            }
          }),
        }))
      : formDefaultValues.stacks,
    startDate: initialValues?.scheduledStartAt
      ? dayjs(initialValues?.scheduledStartAt).local().toDate()
      : formDefaultValues.startDate,
    endDate: initialValues?.scheduledEndAt
      ? dayjs(initialValues?.scheduledEndAt).local().toDate()
      : formDefaultValues.endDate,
    courseStartDate: formDefaultValues.courseStartDate,
    courseEndDate: formDefaultValues.courseEndDate,
    multiplier: initialValues?.pointsMultiplier
      ? String(initialValues?.pointsMultiplier)
      : formDefaultValues.multiplier,
    courseId: initialValues?.course?.id ?? formDefaultValues.courseId,
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
    activityType: 'MICRO_LEARNING',
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
      loadWizardSnapshot<MicroLearningFormValues>(recoveryOptions)

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

  const [createMicroLearning, { data: creationData }] = useMutation(
    CreateMicroLearningDocument
  )
  const [editMicroLearning, { data: editingData }] = useMutation(
    EditMicroLearningDocument
  )
  const handleSubmit = useCallback(
    (values: MicroLearningFormValues) => {
      return submitMicrolearningForm({
        id: initialValues?.id,
        previousCourseId: initialValues?.course?.id,
        values,
        editMode,
        createMicroLearning,
        editMicroLearning,
        setIsWizardCompleted,
        onError: () =>
          toast({
            type: 'error',
            message: (
              <div>
                <div>
                  {editMode
                    ? t('manage.activityWizard.microlearningEditingFailed')
                    : t('manage.activityWizard.microlearningCreationFailed')}
                </div>
                <div>{t('manage.activityWizard.considerFormErrors')}</div>
              </div>
            ),
            options: { duration: 6000 },
          }),
      })
    },
    [createMicroLearning, editMicroLearning, editMode, initialValues?.id]
  )

  const activityId =
    creationData?.createMicroLearning?.id ?? editingData?.editMicroLearning?.id
  const selectedCourseId =
    creationData?.createMicroLearning?.courseId ??
    editingData?.editMicroLearning?.courseId
  const isActivityReviewer =
    creationData?.createMicroLearning?.isActivityReviewer ??
    editingData?.editMicroLearning?.isActivityReviewer

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
                ? t.rich('manage.activityWizard.microlearningCreated', {
                    b: (text) => <strong>{text}</strong>,
                    name: elementName,
                  })
                : t.rich('manage.activityWizard.microlearningEdited', {
                    b: (text) => <strong>{text}</strong>,
                    name: elementName,
                  })}
            </div>
          )}
          name={formData.name}
          editMode={editMode}
          previewElementHref={`${process.env.NEXT_PUBLIC_PWA_URL}/course/${selectedCourseId}/microLearnings/${activityId}/`}
          viewElementHref={
            isActivityReviewer
              ? `/courses/${selectedCourseId}?tab=microLearnings`
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
        <MicroLearningInformationStep
          key="micro-learning-information-step"
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
          onNextStep={(newValues: Partial<MicroLearningFormValues>) => {
            setFormData((prev) => ({ ...prev, ...newValues }))
            setActiveStep((currentStep) => currentStep + 1)
          }}
          closeWizard={closeWizardAndClearSnapshot}
        />,
        <MicroLearningDescriptionStep
          key="micro-learning-description-step"
          editMode={editMode}
          formRef={formRef}
          formData={formData}
          continueDisabled={false}
          activeStep={activeStep}
          stepValidity={stepValidity}
          validationSchema={descriptionValidationSchema}
          setStepValidity={setStepValidity}
          onNextStep={(newValues: Partial<MicroLearningFormValues>) => {
            setFormData((prev) => ({ ...prev, ...newValues }))
            setActiveStep((currentStep) => currentStep + 1)
          }}
          onPrevStep={(newValues: Partial<MicroLearningFormValues>) => {
            setFormData((prev) => ({ ...prev, ...newValues }))
            setActiveStep((currentStep) => currentStep - 1)
          }}
          closeWizard={closeWizardAndClearSnapshot}
        />,
        <MicroLearningSettingsStep
          key="micro-learning-settings-step"
          editMode={editMode}
          formRef={formRef}
          formData={formData}
          continueDisabled={false}
          activeStep={activeStep}
          stepValidity={stepValidity}
          validationSchema={settingsValidationSchema}
          gamifiedCourses={gamifiedCourses}
          nonGamifiedCourses={nonGamifiedCourses}
          assessmentCourses={assessmentCourses}
          setStepValidity={setStepValidity}
          onNextStep={(newValues: Partial<MicroLearningFormValues>) => {
            setFormData((prev) => ({ ...prev, ...newValues }))
            setActiveStep((currentStep) => currentStep + 1)
          }}
          onPrevStep={(newValues: Partial<MicroLearningFormValues>) => {
            setFormData((prev) => ({ ...prev, ...newValues }))
            setActiveStep((currentStep) => currentStep - 1)
          }}
          closeWizard={closeWizardAndClearSnapshot}
        />,
        <StackCreationStep
          key="stack-creation-step"
          editMode={editMode}
          selection={selection}
          resetSelection={resetSelection}
          acceptedTypes={acceptedTypes}
          formRef={formRef}
          formData={formData}
          continueDisabled={false}
          activeStep={activeStep}
          stepValidity={stepValidity}
          validationSchema={stackValiationSchema}
          setStepValidity={setStepValidity}
          onPrevStep={(newValues: Partial<MicroLearningFormValues>) => {
            setFormData((prev) => ({ ...prev, ...newValues }))
            setActiveStep((currentStep) => currentStep - 1)
          }}
          onSubmit={(newValues: MicroLearningFormValues) =>
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

export default MicroLearningWizard
