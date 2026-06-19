import {
  ApolloCache,
  DefaultContext,
  FetchResult,
  MutationFunctionOptions,
} from '@apollo/client'
import {
  CreateGroupActivityMutation,
  CreateGroupActivityMutationVariables,
  EditGroupActivityMutation,
  EditGroupActivityMutationVariables,
} from '@klicker-uzh/graphql/dist/ops'
import dayjs from 'dayjs'
import { GroupActivityFormValues } from '../WizardLayout'

interface GroupActivityFormSubmissionProps {
  id?: string
  previousCourseId?: string
  values: GroupActivityFormValues
  createGroupActivity: (
    options?:
      | MutationFunctionOptions<
          CreateGroupActivityMutation,
          CreateGroupActivityMutationVariables,
          DefaultContext,
          ApolloCache<any>
        >
      | undefined
  ) => Promise<FetchResult<CreateGroupActivityMutation>>
  editGroupActivity: (
    options?:
      | MutationFunctionOptions<
          EditGroupActivityMutation,
          EditGroupActivityMutationVariables,
          DefaultContext,
          ApolloCache<any>
        >
      | undefined
  ) => Promise<FetchResult<EditGroupActivityMutation>>
  setIsWizardCompleted: (isCompleted: boolean) => void
  invalidateCourseDetail: (courseId: string) => Promise<void>
  onError: () => void
}

async function submitGroupActivityForm({
  id,
  previousCourseId,
  values,
  createGroupActivity,
  editGroupActivity,
  setIsWizardCompleted,
  invalidateCourseDetail,
  onError,
}: GroupActivityFormSubmissionProps) {
  try {
    let success = false
    if (id) {
      const { data: result } = await editGroupActivity({
        variables: {
          id,
          name: values.name,
          displayName: values.displayName,
          description: values.description,
          startDate: dayjs(values.startDate).utc().format(),
          endDate: dayjs(values.endDate).utc().format(),
          multiplier: parseInt(values.multiplier),
          courseId: values.courseId!,
          clues: values.clues,
          stack: {
            elements: values.stack.elements.map((element, ix) => ({
              elementId: element.id,
              order: ix,
              existingInstanceId: element.existingInstanceId,
              duplicateInstance: element.duplicateInstance,
            })),
            order: 0,
          },
        },
      })

      success = Boolean(result?.editGroupActivity)
      if (result?.editGroupActivity?.courseId) {
        const courseIds = new Set(
          [previousCourseId, result.editGroupActivity.courseId].filter(
            (courseId): courseId is string => Boolean(courseId)
          )
        )
        await Promise.all(Array.from(courseIds).map(invalidateCourseDetail))
      }
    } else {
      const { data: result } = await createGroupActivity({
        variables: {
          name: values.name,
          displayName: values.displayName,
          description: values.description,
          startDate: dayjs(values.startDate).utc().format(),
          endDate: dayjs(values.endDate).utc().format(),
          multiplier: parseInt(values.multiplier),
          courseId: values.courseId!,
          clues: values.clues,
          stack: {
            elements: values.stack.elements.map((element, ix) => ({
              elementId: element.id,
              order: ix,
              existingInstanceId: element.existingInstanceId,
              duplicateInstance: element.duplicateInstance,
            })),
            order: 0,
          },
        },
      })

      success = Boolean(result?.createGroupActivity)
      if (result?.createGroupActivity?.courseId) {
        await invalidateCourseDetail(result.createGroupActivity.courseId)
      }
    }

    if (success) {
      setIsWizardCompleted(true)
    }
  } catch (error) {
    console.log(error)
    onError()
  }
}

export default submitGroupActivityForm
