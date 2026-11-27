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
  GetSingleCourseDocument,
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
  onError: () => void
}

async function submitGroupActivityForm({
  id,
  previousCourseId,
  values,
  createGroupActivity,
  editGroupActivity,
  setIsWizardCompleted,
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
          multiplier: parseInt(values.multiplier, 10),
          courseId: values.courseId!,
          clues: values.clues,
          stack: {
            elements: values.stack.elements.map((element, ix) => ({
              elementId: element.id,
              order: ix,
              existingInstanceId: element.existingInstanceId,
              duplicateInstance: element.duplicateInstance,
              escapeRoomHint: element.escapeRoomHint,
            })),
            order: 0,
          },
          isEscapeRoom: values.isEscapeRoom ?? false,
          escapeRoomTimeLimit: values.isEscapeRoom
            ? parseInt(values.escapeRoomTimeLimit ?? '60', 10) * 60
            : undefined,
          escapeRoomHintPenalty: values.isEscapeRoom
            ? parseInt(values.escapeRoomHintPenalty ?? '0', 10)
            : undefined,
          escapeRoomIntroText: values.isEscapeRoom
            ? values.escapeRoomIntroText || undefined
            : undefined,
        },
        update: (cache, { data: res }) => {
          // if the mutation was not successful, return early
          if (!res?.editGroupActivity?.courseId) return

          // if the course assignment changed, remove the microlearning from the previous course
          if (
            previousCourseId &&
            res.editGroupActivity.courseId !== previousCourseId
          ) {
            cache.updateQuery(
              {
                query: GetSingleCourseDocument,
                variables: { courseId: previousCourseId },
              },
              (data) => {
                if (!data?.course) return data

                return {
                  course: {
                    ...data.course,
                    groupActivitiesInfo:
                      data.course.groupActivitiesInfo?.filter(
                        (ga) => ga.id !== res.editGroupActivity!.id
                      ),
                  },
                }
              }
            )
          }

          // updated / add the group activity in the currently assigned course
          cache.updateQuery(
            {
              query: GetSingleCourseDocument,
              variables: { courseId: res.editGroupActivity.courseId },
            },
            (data) => {
              if (!data?.course) return data

              const activities = [
                ...(data.course.groupActivitiesInfo?.filter(
                  (ga) => ga.id !== res.editGroupActivity!.id
                ) ?? []),
                res.editGroupActivity!,
              ]
              return {
                course: { ...data.course, groupActivitiesInfo: activities },
              }
            }
          )
        },
      })

      success = Boolean(result?.editGroupActivity)
    } else {
      const { data: result } = await createGroupActivity({
        variables: {
          name: values.name,
          displayName: values.displayName,
          description: values.description,
          startDate: dayjs(values.startDate).utc().format(),
          endDate: dayjs(values.endDate).utc().format(),
          multiplier: parseInt(values.multiplier, 10),
          courseId: values.courseId!,
          clues: values.clues,
          stack: {
            elements: values.stack.elements.map((element, ix) => ({
              elementId: element.id,
              order: ix,
              existingInstanceId: element.existingInstanceId,
              duplicateInstance: element.duplicateInstance,
              escapeRoomHint: element.escapeRoomHint,
            })),
            order: 0,
          },
          isEscapeRoom: values.isEscapeRoom ?? false,
          escapeRoomTimeLimit: values.isEscapeRoom
            ? parseInt(values.escapeRoomTimeLimit ?? '60', 10) * 60
            : undefined,
          escapeRoomHintPenalty: values.isEscapeRoom
            ? parseInt(values.escapeRoomHintPenalty ?? '0', 10)
            : undefined,
          escapeRoomIntroText: values.isEscapeRoom
            ? values.escapeRoomIntroText || undefined
            : undefined,
        },
        update: (cache, { data: res }) => {
          // if the mutation was not successful, return early
          if (!res?.createGroupActivity?.courseId) return

          // change the status of the group activity on the course overview back to draft
          cache.updateQuery(
            {
              query: GetSingleCourseDocument,
              variables: { courseId: res.createGroupActivity.courseId },
            },
            (data) => {
              if (!data?.course) return data

              return {
                course: {
                  ...data.course,
                  groupActivitiesInfo: [
                    ...(data.course.groupActivitiesInfo ?? []),
                    res.createGroupActivity!,
                  ],
                },
              }
            }
          )
        },
      })

      success = Boolean(result?.createGroupActivity)
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
