import {
  ApolloCache,
  DefaultContext,
  FetchResult,
  MutationFunctionOptions,
} from '@apollo/client'
import {
  CreateMicroLearningMutation,
  CreateMicroLearningMutationVariables,
  EditMicroLearningMutation,
  EditMicroLearningMutationVariables,
} from '@klicker-uzh/graphql/dist/ops'
import dayjs from 'dayjs'
import {
  ElementStackFormValues,
  MicroLearningFormValues,
} from '../WizardLayout'

interface MicroLearningFormSubmissionProps {
  id?: string
  previousCourseId?: string
  values: MicroLearningFormValues
  editMode: boolean
  createMicroLearning: (
    options?:
      | MutationFunctionOptions<
          CreateMicroLearningMutation,
          CreateMicroLearningMutationVariables,
          DefaultContext,
          ApolloCache<any>
        >
      | undefined
  ) => Promise<FetchResult<CreateMicroLearningMutation>>
  editMicroLearning: (
    options?:
      | MutationFunctionOptions<
          EditMicroLearningMutation,
          EditMicroLearningMutationVariables,
          DefaultContext,
          ApolloCache<any>
        >
      | undefined
  ) => Promise<FetchResult<EditMicroLearningMutation>>
  setIsWizardCompleted: (isCompleted: boolean) => void
  invalidateCourseDetail: (courseId: string) => Promise<void>
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
      startDate: dayjs(values.startDate).utc().format(),
      endDate: dayjs(values.endDate).utc().format(),
      multiplier: parseInt(values.multiplier),
      courseId: values.courseId!,
    }

    if (editMode && id) {
      const { data: result } = await editMicroLearning({
        variables: { id, ...createUpdateJSON },
      })
      success = Boolean(result?.editMicroLearning)
      if (result?.editMicroLearning?.courseId) {
        const courseIds = new Set(
          [previousCourseId, result.editMicroLearning.courseId].filter(
            (courseId): courseId is string => Boolean(courseId)
          )
        )
        await Promise.all(Array.from(courseIds).map(invalidateCourseDetail))
      }
    } else {
      const { data: result } = await createMicroLearning({
        variables: createUpdateJSON,
      })
      success = Boolean(result?.createMicroLearning)
      if (result?.createMicroLearning?.courseId) {
        await invalidateCourseDetail(result.createMicroLearning.courseId)
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

export default submitMicrolearningForm
