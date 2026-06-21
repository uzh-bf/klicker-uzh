import dayjs from 'dayjs'
import type { RouterInputs, RouterOutputs } from '../../../../lib/trpc'
import {
  ElementStackFormValues,
  MicroLearningFormValues,
} from '../WizardLayout'

type CreateMicroLearningInput = RouterInputs['activity']['createMicroLearning']
type CreateMicroLearningResult =
  RouterOutputs['activity']['createMicroLearning']
type EditMicroLearningInput = RouterInputs['activity']['editMicroLearning']
type EditMicroLearningResult = RouterOutputs['activity']['editMicroLearning']

interface MicroLearningFormSubmissionProps {
  id?: string
  previousCourseId?: string
  values: MicroLearningFormValues
  editMode: boolean
  createMicroLearning: (
    input: CreateMicroLearningInput
  ) => Promise<CreateMicroLearningResult>
  editMicroLearning: (
    input: EditMicroLearningInput
  ) => Promise<EditMicroLearningResult>
  setIsWizardCompleted: (isCompleted: boolean) => void
  invalidateCourseDetail: (courseId: string) => Promise<void>
  invalidateActivities: () => Promise<void>
  onError: () => void
}

async function submitMicrolearningForm({
  id,
  previousCourseId,
  values,
  editMode,
  createMicroLearning,
  editMicroLearning,
  setIsWizardCompleted,
  invalidateCourseDetail,
  invalidateActivities,
  onError,
}: MicroLearningFormSubmissionProps) {
  try {
    let success = false

    const createUpdateJSON = {
      name: values.name,
      displayName: values.displayName,
      description: values.description,
      stacks: values.stacks.map((stack: ElementStackFormValues, ix) => ({
        order: ix,
        displayName:
          stack.displayName && stack.displayName.length > 0
            ? stack.displayName
            : undefined,
        description:
          stack.description && stack.description.length > 0
            ? stack.description
            : undefined,
        elements: stack.elements.map((element, ix) => ({
          elementId: element.id,
          order: ix,
          existingInstanceId: element.existingInstanceId,
          duplicateInstance: element.duplicateInstance,
        })),
      })),
      startDate: dayjs(values.startDate).utc().toDate(),
      endDate: dayjs(values.endDate).utc().toDate(),
      multiplier: parseInt(values.multiplier),
      courseId: values.courseId!,
    }

    if (editMode && id) {
      const result = await editMicroLearning({ id, ...createUpdateJSON })
      success = Boolean(result.editMicroLearning)
      if (result.editMicroLearning?.courseId) {
        const courseIds = new Set(
          [previousCourseId, result.editMicroLearning.courseId].filter(
            (courseId): courseId is string => Boolean(courseId)
          )
        )
        void Promise.all(
          Array.from(courseIds).map(invalidateCourseDetail)
        ).catch(console.error)
      }
    } else {
      const result = await createMicroLearning(createUpdateJSON)
      success = Boolean(result.createMicroLearning)
      if (result.createMicroLearning?.courseId) {
        void invalidateCourseDetail(result.createMicroLearning.courseId).catch(
          console.error
        )
      }
    }

    if (success) {
      void invalidateActivities().catch(console.error)
      setIsWizardCompleted(true)
    } else {
      onError()
    }
  } catch (error) {
    console.log(error)
    onError()
  }
}

export default submitMicrolearningForm
