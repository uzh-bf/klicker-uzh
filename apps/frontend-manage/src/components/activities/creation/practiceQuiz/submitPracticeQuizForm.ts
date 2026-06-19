import {
  ApolloCache,
  DefaultContext,
  FetchResult,
  MutationFunctionOptions,
} from '@apollo/client'
import {
  CreatePracticeQuizMutation,
  CreatePracticeQuizMutationVariables,
  EditPracticeQuizMutation,
  EditPracticeQuizMutationVariables,
} from '@klicker-uzh/graphql/dist/ops'
import { ElementStackFormValues, PracticeQuizFormValues } from '../WizardLayout'

interface PracticeQuizFormSubmissionProps {
  id?: string
  previousCourseId?: string
  values: PracticeQuizFormValues
  editMode: boolean
  createPracticeQuiz: (
    options?:
      | MutationFunctionOptions<
          CreatePracticeQuizMutation,
          CreatePracticeQuizMutationVariables,
          DefaultContext,
          ApolloCache<any>
        >
      | undefined
  ) => Promise<FetchResult<CreatePracticeQuizMutation>>
  editPracticeQuiz: (
    options?:
      | MutationFunctionOptions<
          EditPracticeQuizMutation,
          EditPracticeQuizMutationVariables,
          DefaultContext,
          ApolloCache<any>
        >
      | undefined
  ) => Promise<FetchResult<EditPracticeQuizMutation>>
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
      order: values.order,
      resetTimeDays: parseInt(values.resetTimeDays),
    }

    if (editMode && id) {
      const result = await editPracticeQuiz({
        variables: { id, ...createOrUpdateJSON },
      })

      success = Boolean(result.data?.editPracticeQuiz)
      if (result.data?.editPracticeQuiz?.courseId) {
        const courseIds = new Set(
          [previousCourseId, result.data.editPracticeQuiz.courseId].filter(
            (courseId): courseId is string => Boolean(courseId)
          )
        )
        await Promise.all(Array.from(courseIds).map(invalidateCourseDetail))
      }
    } else {
      const result = await createPracticeQuiz({
        variables: createOrUpdateJSON,
      })

      success = Boolean(result.data?.createPracticeQuiz)
      if (result.data?.createPracticeQuiz?.courseId) {
        await invalidateCourseDetail(result.data.createPracticeQuiz.courseId)
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
