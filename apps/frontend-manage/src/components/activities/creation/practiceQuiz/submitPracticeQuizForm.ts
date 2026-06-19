import type { RouterInputs, RouterOutputs } from '../../../../lib/trpc'
import { ElementStackFormValues, PracticeQuizFormValues } from '../WizardLayout'

type CreatePracticeQuizInput = RouterInputs['activity']['createPracticeQuiz']
type CreatePracticeQuizResult = RouterOutputs['activity']['createPracticeQuiz']
type EditPracticeQuizInput = RouterInputs['activity']['editPracticeQuiz']
type EditPracticeQuizResult = RouterOutputs['activity']['editPracticeQuiz']

interface PracticeQuizFormSubmissionProps {
  id?: string
  previousCourseId?: string
  values: PracticeQuizFormValues
  editMode: boolean
  createPracticeQuiz: (
    input: CreatePracticeQuizInput
  ) => Promise<CreatePracticeQuizResult>
  editPracticeQuiz: (
    input: EditPracticeQuizInput
  ) => Promise<EditPracticeQuizResult>
  setIsWizardCompleted: (isCompleted: boolean) => void
  invalidateCourseDetail: (courseId: string) => Promise<void>
  onError: () => void
}

async function submitPracticeQuizForm({
  id,
  previousCourseId,
  values,
  editMode,
  createPracticeQuiz,
  editPracticeQuiz,
  setIsWizardCompleted,
  invalidateCourseDetail,
  onError,
}: PracticeQuizFormSubmissionProps) {
  try {
    let success = false

    const createOrUpdateJSON = {
      name: values.name,
      displayName: values.displayName,
      description: values.description,
      stacks: values.stacks.map((stack: ElementStackFormValues, ix) => {
        return {
          order: ix,
          displayName:
            stack.displayName && stack.displayName.length > 0
              ? stack.displayName
              : undefined,
          description:
            stack.description && stack.description.length > 0
              ? stack.description
              : undefined,
          elements: stack.elements.map((element, ix) => {
            return {
              elementId: element.id,
              order: ix,
              existingInstanceId: element.existingInstanceId,
              duplicateInstance: element.duplicateInstance,
            }
          }),
        }
      }),
      multiplier: parseInt(values.multiplier),
      courseId: values.courseId!,
      order: values.order as CreatePracticeQuizInput['order'],
      resetTimeDays: parseInt(values.resetTimeDays),
    }

    if (editMode && id) {
      const result = await editPracticeQuiz({ id, ...createOrUpdateJSON })

      success = Boolean(result.editPracticeQuiz)
      if (result.editPracticeQuiz?.courseId) {
        const courseIds = new Set(
          [previousCourseId, result.editPracticeQuiz.courseId].filter(
            (courseId): courseId is string => Boolean(courseId)
          )
        )
        await Promise.all(Array.from(courseIds).map(invalidateCourseDetail))
      }
    } else {
      const result = await createPracticeQuiz(createOrUpdateJSON)

      success = Boolean(result.createPracticeQuiz)
      if (result.createPracticeQuiz?.courseId) {
        await invalidateCourseDetail(result.createPracticeQuiz.courseId)
      }
    }

    if (success) {
      setIsWizardCompleted(true)
    } else {
      onError()
    }
  } catch (error) {
    console.log(error)
    onError()
  }
}

export default submitPracticeQuizForm
