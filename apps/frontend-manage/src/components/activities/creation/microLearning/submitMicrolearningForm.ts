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
  GetSingleCourseDocument,
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
          escapeRoomHint: values.isEscapeRoom
            ? (element.escapeRoomHint ?? undefined)
            : undefined,
        })),
      })),
      startDate: dayjs(values.startDate).utc().format(),
      endDate: dayjs(values.endDate).utc().format(),
      multiplier: parseInt(values.multiplier, 10),
      courseId: values.courseId!,
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
    }

    if (editMode && id) {
      const { data: result } = await editMicroLearning({
        variables: { id, ...createUpdateJSON },
        update: (cache, { data: res }) => {
          // if the mutation was not successful, return early
          if (!res?.editMicroLearning?.courseId) return

          // if the course assignment changed, remove the microlearning from the previous course
          if (
            previousCourseId &&
            res.editMicroLearning.courseId !== previousCourseId
          ) {
            cache.updateQuery(
              {
                query: GetSingleCourseDocument,
                variables: { courseId: previousCourseId },
              },
              (data) => {
                if (!data?.course) return data

                const activities =
                  data.course.microLearningsInfo?.filter(
                    (ml) => ml.id !== res.editMicroLearning!.id
                  ) ?? []
                return {
                  course: { ...data.course, microLearningsInfo: activities },
                }
              }
            )
          }

          // updated / add the microlearning in the currently assigned course
          cache.updateQuery(
            {
              query: GetSingleCourseDocument,
              variables: { courseId: res.editMicroLearning.courseId! },
            },
            (data) => {
              if (!data?.course) return data

              const activities = [
                ...(data.course.microLearningsInfo?.filter(
                  (ml) => ml.id !== res.editMicroLearning!.id
                ) ?? []),
                res.editMicroLearning!,
              ]
              return {
                course: { ...data.course, microLearningsInfo: activities },
              }
            }
          )
        },
      })
      success = Boolean(result?.editMicroLearning)
    } else {
      const { data: result } = await createMicroLearning({
        variables: createUpdateJSON,
        update: (cache, { data: res }) => {
          // if the mutation was not successful, return early
          if (!res?.createMicroLearning?.courseId) return

          // change the status of the microlearning on the course overview back to draft
          cache.updateQuery(
            {
              query: GetSingleCourseDocument,
              variables: { courseId: res.createMicroLearning.courseId! },
            },
            (data) => {
              if (!data?.course) return data

              return {
                course: {
                  ...data.course,
                  microLearningsInfo: [
                    ...(data.course.microLearningsInfo ?? []),
                    res.createMicroLearning!,
                  ],
                },
              }
            }
          )
        },
      })
      success = Boolean(result?.createMicroLearning)
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
