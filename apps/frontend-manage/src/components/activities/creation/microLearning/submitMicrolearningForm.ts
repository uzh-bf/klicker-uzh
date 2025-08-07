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

interface MicroLearningFormProps {
  id?: string
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
  setSelectedCourseId: (courseId?: string) => void
  setIsWizardCompleted: (isCompleted: boolean) => void
  onError: () => void
}

async function submitMicrolearningForm({
  id,
  values,
  editMode,
  createMicroLearning,
  editMicroLearning,
  setSelectedCourseId,
  setIsWizardCompleted,
  onError,
}: MicroLearningFormProps) {
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
        update: (cache, { data: res }) => {
          // if the mutation was not successful, return early
          if (!res?.editMicroLearning) return

          // change the status of the microlearning on the course overview back to draft
          cache.updateQuery(
            {
              query: GetSingleCourseDocument,
              variables: { courseId: values.courseId! },
            },
            (data) => {
              if (!data?.course) return data

              const activities = [
                ...(data.course.microLearningsInfo?.filter(
                  (ga) => ga.id !== res.editMicroLearning!.id
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
          if (!res?.createMicroLearning) return

          // change the status of the microlearning on the course overview back to draft
          cache.updateQuery(
            {
              query: GetSingleCourseDocument,
              variables: { courseId: values.courseId! },
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
      setSelectedCourseId(values.courseId)
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
